import { createAdminClient } from "@/lib/supabase/admin"
import { addWorkingMins } from "@/hooks/time-utils"
import { totalStageDurationMins, computeExpectedCompletion } from "@/lib/job-estimates"

export async function getJobDetailData(id: string) {
  const supabase = createAdminClient()

  const { data: job, error } = await supabase
    .from("job_order")
    .select(
      `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at, finishing_approved_at,
       customer:customer_record_id(full_name, plate_number, vehicle_unit, contact_number),
       service:service_id(name),
       customer_name, contact_number, plate_number, vehicle_unit`
    )
    .eq("id", id)
    .single()

  if (error || !job) throw new Error(error?.message ?? "Not found.")

  const { data: team } = await supabase
    .from("job_order_team")
    .select("role_in_job, user_account:user_account_id(id, full_name), technician:technician_id(id, full_name)")
    .eq("job_order_id", id)

  const { data: history } = await supabase
    .from("job_order_history")
    .select("status, created_at, changed_by:changed_by_id(full_name)")
    .eq("job_order_id", id)
    .order("created_at", { ascending: true })

  const { data: stages } = await supabase
    .from("job_stage_progress")
    .select(
      `id, status, rework_instructions, handoff_notes, completion_notes, completed_at,
       messenger_sent, messenger_sent_at,
       custom_name, custom_sequence_order, stage_duration_mins,
       service_stage_id,
       media:stage_media(id, file_url, media_type)`
    )
    .eq("job_order_id", id)
    .order("custom_sequence_order")

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

  const j = job as any

  const totalDurationMins = totalStageDurationMins(stages ?? [], ssMap)

  const { expected, updated } = computeExpectedCompletion({
    scheduled_at: j.scheduled_at,
    actual_start_at: j.actual_start_at,
    totalDurationMins,
  })
  const expectedCompletionAt: string | null = expected ?? (j.expected_completion_at ?? null)
  const updatedEstAt: string | null = updated

  const headDetailer  = (team ?? []).find((t: any) => t.role_in_job === "head_detailer")
  const headInstaller = (team ?? []).find((t: any) => t.role_in_job === "head_installer")
  const detailers     = (team ?? [])
    .filter((t: any) => t.role_in_job === "detailer")
    .map((t: any) => ({ id: (t.technician as any)?.id ?? "", name: (t.technician as any)?.full_name ?? "Unknown" }))
  const installers    = (team ?? [])
    .filter((t: any) => t.role_in_job === "installer")
    .map((t: any) => ({ id: (t.technician as any)?.id ?? "", name: (t.technician as any)?.full_name ?? "Unknown" }))

  const mappedStages = (() => {
    const mapped = (stages ?? []).map((s: any) => {
      const ss  = s.service_stage_id ? ssMap.get(s.service_stage_id) : null
      const cat = ss?.category_id ? catMap.get(ss.category_id) : null
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
        media: s.media ?? [],
        is_delayed: false,
        expected_end_at: null as string | null,
        _raw_duration_mins: (s.stage_duration_mins as number | null) ?? null,
      }
    })

    if (j.actual_start_at) {
      const sorted = [...mapped].sort((a, b) => a.sequence_order - b.sequence_order)
      const nowMs = Date.now()
      let cumulativeMins = 0
      const jobStart = new Date(j.actual_start_at)
      for (const stage of sorted) {
        const overrideDuration = stage._raw_duration_mins as number | null
        const serviceDuration  = stage.id
          ? (ssMap.get(stages?.find((s: any) => s.id === stage.id)?.service_stage_id)?.stage_duration_mins ?? 0)
          : 0
        const durationMins = overrideDuration != null ? overrideDuration : serviceDuration
        cumulativeMins += durationMins
        if (durationMins > 0) {
          const expectedEnd = addWorkingMins(jobStart, cumulativeMins)
          stage.expected_end_at = expectedEnd.toISOString()
          stage.is_delayed = stage.status !== "done" && stage.status !== "for_rework" && nowMs > expectedEnd.getTime()
        }
      }
    }

    return mapped.map(({ _raw_duration_mins: _rd, ...rest }) => rest)
  })()

  return {
    job: {
      id: j.id,
      customer_name: j.customer?.full_name ?? j.customer_name ?? "—",
      plate_number: j.customer?.plate_number ?? j.plate_number ?? "—",
      vehicle_unit: j.customer?.vehicle_unit ?? j.vehicle_unit ?? "—",
      contact_number: j.customer?.contact_number ?? j.contact_number ?? "—",
      service: j.service?.name ?? "—",
      head_detailer: (headDetailer?.user_account as any) ?? null,
      head_installer: (headInstaller?.user_account as any) ?? null,
      detailers,
      installers,
      status: j.status,
      scheduled_at: j.scheduled_at,
      actual_start_at: j.actual_start_at,
      expected_completion_at: expectedCompletionAt,
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
