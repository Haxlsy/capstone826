import { createAdminClient } from "@/lib/supabase/admin"
import { computeStageDelays, isJobDelayed } from "@/lib/job-delay"
import { totalStageDurationMins, computeExpectedCompletion } from "@/lib/job-estimates"

export async function getJobDetailData(id: string) {
  const supabase = createAdminClient()

  // These four only need the already-known `id` param — none depends on
  // another's result — so run them concurrently instead of four sequential
  // round-trips (same fix already applied to the head-technician job route).
  const [
    { data: job, error },
    { data: team },
    { data: history },
    { data: stages },
  ] = await Promise.all([
    supabase
      .from("job_order")
      .select(
        `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at, finishing_approved_at, job_order_code,
         customer:customer_record_id(full_name, plate_number, vehicle_unit, contact_number, email),
         service:service_id(name),
         customer_name, contact_number, plate_number, vehicle_unit`
      )
      .eq("id", id)
      .single(),
    supabase
      .from("job_order_team")
      .select("role_in_job, user_account:user_account_id(id, full_name), technician:technician_id(id, full_name)")
      .eq("job_order_id", id),
    supabase
      .from("job_order_history")
      .select("status, created_at, changed_by:changed_by_id(full_name)")
      .eq("job_order_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("job_stage_progress")
      .select(
        `id, status, rework_instructions, handoff_notes, completion_notes, completed_at,
         messenger_sent, messenger_sent_at,
         custom_name, custom_sequence_order, custom_stage_category, stage_duration_mins,
         service_stage_id, current_rework_round,
         media:stage_media(id, file_url, media_type, rework_round)`
      )
      .eq("job_order_id", id)
      .order("custom_sequence_order"),
  ])

  if (error || !job) throw new Error(error?.message ?? "Not found.")

  const ssIds = [...new Set((stages ?? []).map((s: any) => s.service_stage_id as string).filter(Boolean))]
  let ssRows: any[] = []
  if (ssIds.length > 0) {
    const { data } = await supabase
      .from("service_stage")
      .select("id, name, sequence_order, category_id, stage_duration_mins")
      .in("id", ssIds)
    ssRows = (data ?? []) as any[]
  }
  const ssMap = new Map(ssRows.map((r: any) => [r.id, r]))

  const catIds = [...new Set(ssRows.map((r: any) => r.category_id).filter(Boolean) as string[])]
  let catRows: any[] = []
  if (catIds.length > 0) {
    const { data } = await supabase
      .from("workflow_category")
      .select("id, name, display_color, technician_role")
      .in("id", catIds)
    catRows = (data ?? []) as any[]
  }
  const catMap = new Map(catRows.map((r: any) => [r.id, r]))
  // Custom (job-only) stages have no service_stage_id to derive a category
  // from via ssMap/catMap — they carry the category as a name in
  // custom_stage_category instead (see supabase/migrations/20260422000002_custom_job_stages.sql).
  // Matched by name against the same catRows so a custom stage groups into
  // the same section as its seeded siblings instead of falling into its own
  // stray "Unknown" group.
  const catByName = new Map(catRows.map((r: any) => [r.name, r]))

  const j = job as any

  const totalDurationMins = totalStageDurationMins(stages ?? [], ssMap)

  const { expected, updated } = computeExpectedCompletion({
    scheduled_at: j.scheduled_at,
    actual_start_at: j.actual_start_at,
    totalDurationMins,
  })
  const expectedCompletionAt: string | null = expected ?? (j.expected_completion_at ?? null)
  const updatedEstAt: string | null = updated

  // First row of each head role is the primary; any additional rows are
  // substitutes added from Operations' Job Order Detail. `(t: any)` matches
  // this file's existing convention — Supabase infers embedded to-one
  // relations as arrays, which every mapping below already casts around.
  const headDetailerRows  = (team ?? []).filter((t: any) => t.role_in_job === "head_detailer")
  const headInstallerRows = (team ?? []).filter((t: any) => t.role_in_job === "head_installer")
  const headDetailer  = headDetailerRows[0]
  const headInstaller = headInstallerRows[0]
  const toSub = (t: any) => ({ id: (t.user_account as any)?.id ?? "", full_name: (t.user_account as any)?.full_name ?? "Unknown" })
  const headDetailerSubs  = headDetailerRows.slice(1).map(toSub)
  const headInstallerSubs = headInstallerRows.slice(1).map(toSub)
  const detailers     = (team ?? [])
    .filter((t: any) => t.role_in_job === "detailer")
    .map((t: any) => ({ id: (t.technician as any)?.id ?? "", name: (t.technician as any)?.full_name ?? "Unknown" }))
  const installers    = (team ?? [])
    .filter((t: any) => t.role_in_job === "installer")
    .map((t: any) => ({ id: (t.technician as any)?.id ?? "", name: (t.technician as any)?.full_name ?? "Unknown" }))

  const mappedStages = (() => {
    const mapped = (stages ?? []).map((s: any) => {
      const ss  = s.service_stage_id ? ssMap.get(s.service_stage_id) : null
      const cat = ss?.category_id
        ? catMap.get(ss.category_id)
        : s.custom_stage_category
          ? catByName.get(s.custom_stage_category)
          : null
      return {
        id: s.id,
        service_stage_id: s.service_stage_id ?? null,
        name: s.custom_name ?? ss?.name ?? "—",
        sequence_order: s.custom_sequence_order ?? ss?.sequence_order ?? 0,
        category_id: cat?.id ?? null,
        category_name: cat?.name ?? null,
        category_color: cat?.display_color ?? null,
        status: s.status,
        rework_instructions: s.rework_instructions,
        handoff_notes: s.handoff_notes,
        completion_notes: s.completion_notes ?? null,
        completed_at: s.completed_at,
        messenger_sent: s.messenger_sent ?? null,
        messenger_sent_at: s.messenger_sent_at ?? null,
        // Round 0 is the original, customer-facing upload — this stays
        // exactly what `media` has always meant, so every existing consumer
        // (including Sales' read-only view, which shares this loader) keeps
        // working unchanged. Rework redos (round 1+) are additive and
        // operations-only — see supabase/migrations/20260917000004_stage_media_rework_rounds.sql.
        media: (s.media ?? []).filter((m: any) => (m.rework_round ?? 0) === 0),
        rework_media: (s.media ?? []).filter((m: any) => (m.rework_round ?? 0) > 0),
        current_rework_round: (s.current_rework_round as number | null) ?? 0,
        is_delayed: false,
        expected_end_at: null as string | null,
        _raw_duration_mins: (s.stage_duration_mins as number | null) ?? null,
        _service_duration_mins: (ss?.stage_duration_mins as number | null) ?? null,
      }
    })

    // lib/job-delay.ts — the single shared definition of "delayed", also used
    // by Head Detailer/Installer's job list and job-detail endpoints.
    const delays = computeStageDelays(
      mapped.map((s) => ({
        id: s.id,
        status: s.status,
        sequence_order: s.sequence_order,
        stage_duration_mins: s._raw_duration_mins,
        service_stage_duration_mins: s._service_duration_mins,
      })),
      j.actual_start_at,
    )
    for (const stage of mapped) {
      const d = delays.get(stage.id)
      if (d) {
        stage.expected_end_at = d.expected_end_at
        stage.is_delayed = d.is_delayed
      }
    }

    return mapped.map(({ _raw_duration_mins: _rd, _service_duration_mins: _sd, ...rest }) => rest)
  })()

  return {
    job: {
      id: j.id,
      job_order_code: j.job_order_code,
      customer_name: j.customer?.full_name ?? j.customer_name ?? "—",
      plate_number: j.customer?.plate_number ?? j.plate_number ?? "—",
      vehicle_unit: j.customer?.vehicle_unit ?? j.vehicle_unit ?? "—",
      contact_number: j.customer?.contact_number ?? j.contact_number ?? "—",
      email: j.customer?.email ?? null,
      service: j.service?.name ?? "—",
      head_detailer: (headDetailer?.user_account as any) ?? null,
      head_installer: (headInstaller?.user_account as any) ?? null,
      head_detailer_substitutes: headDetailerSubs,
      head_installer_substitutes: headInstallerSubs,
      detailers,
      installers,
      status: j.status,
      is_overdue: isJobDelayed({ status: j.status, expected_completion_at: expectedCompletionAt }),
      scheduled_at: j.scheduled_at,
      actual_start_at: j.actual_start_at,
      expected_completion_at: expectedCompletionAt,
      // Lets the client preview a new Est. Completion (via the existing
      // /api/operations/job-management/estimate-completion endpoint) while
      // editing Scheduled Start, without re-implementing working-hours math
      // in the browser.
      total_duration_mins: totalDurationMins,
      updated_est: updatedEstAt,
      created_at: j.created_at,
      finishing_approved_at: j.finishing_approved_at,
      history: (history ?? []).map((h: any) => ({
        status: h.status,
        created_at: h.created_at,
        changed_by: h.changed_by?.full_name ?? "System",
      })),
      stages: mappedStages,
    },
  }
}

export type JobDetailData = Awaited<ReturnType<typeof getJobDetailData>>
