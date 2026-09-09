import { createAdminClient } from "@/lib/supabase/admin"
import { isJobDelayed } from "@/lib/job-delay"

export async function getJobOrdersData(released = false) {
  const supabase = createAdminClient()

  let query = supabase
    .from("job_order")
    .select(
      `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at, job_order_code,
       customer:customer_record_id(full_name, plate_number, vehicle_unit, contact_number),
       service:service_id(name),
       customer_name, contact_number, plate_number, vehicle_unit`
    )
    .order("created_at", { ascending: false })

  if (released) {
    query = query.eq("status", "Released")
  } else {
    query = query.neq("status", "Released")
  }

  const { data: jobs, error } = await query
  if (error) throw new Error(error.message)

  const jobIds = (jobs ?? []).map((j: any) => j.id)

  const [teamResult, stageResult] = await Promise.all([
    supabase
      .from("job_order_team")
      .select("job_order_id, role_in_job, user_account:user_account_id(id, full_name)")
      .in("job_order_id", jobIds)
      .in("role_in_job", ["head_detailer", "head_installer"]),
    supabase
      .from("job_stage_progress")
      .select("job_order_id, status")
      .in("job_order_id", jobIds),
  ])

  const teamRows = teamResult.data ?? []
  const stageRows = stageResult.data ?? []

  const teamMap = new Map<string, { head_detailer: string; head_installer: string }>()
  for (const t of teamRows) {
    const entry = teamMap.get(t.job_order_id) ?? { head_detailer: "Unassigned", head_installer: "Unassigned" }
    const ua = t.user_account as any
    if (t.role_in_job === "head_detailer") entry.head_detailer = ua?.full_name ?? "Unassigned"
    if (t.role_in_job === "head_installer") entry.head_installer = ua?.full_name ?? "Unassigned"
    teamMap.set(t.job_order_id, entry)
  }

  const progressMap = new Map<string, { total: number; done: number }>()
  for (const s of stageRows) {
    const entry = progressMap.get(s.job_order_id) ?? { total: 0, done: 0 }
    entry.total++
    if (s.status === "done") entry.done++
    progressMap.set(s.job_order_id, entry)
  }

  const releasedAtMap = new Map<string, string>()
  if (released && jobIds.length > 0) {
    const { data: historyRows } = await supabase
      .from("job_order_history")
      .select("job_order_id, created_at")
      .in("job_order_id", jobIds)
      .eq("status", "Released")
      .order("created_at", { ascending: false })
    for (const h of historyRows ?? []) {
      if (!releasedAtMap.has(h.job_order_id)) {
        releasedAtMap.set(h.job_order_id, h.created_at)
      }
    }
  }

  const result = (jobs ?? []).map((j: any) => {
    const prog = progressMap.get(j.id) ?? { total: 0, done: 0 }
    const team = teamMap.get(j.id) ?? { head_detailer: "Unassigned", head_installer: "Unassigned" }
    return {
      id: j.id,
      job_order_code: j.job_order_code,
      customer_name: j.customer?.full_name ?? j.customer_name ?? "—",
      plate_number: j.customer?.plate_number ?? j.plate_number ?? "—",
      vehicle_unit: j.customer?.vehicle_unit ?? j.vehicle_unit ?? "—",
      contact_number: j.customer?.contact_number ?? j.contact_number ?? "—",
      service: j.service?.name ?? "—",
      head_detailer: team.head_detailer,
      head_installer: team.head_installer,
      status: j.status,
      scheduled_at: j.scheduled_at,
      actual_start_at: j.actual_start_at,
      expected_completion_at: j.expected_completion_at,
      released_at: releasedAtMap.get(j.id) ?? null,
      created_at: j.created_at,
      progress: prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0,
      is_overdue: isJobDelayed(j),
    }
  })

  return { job_orders: result }
}

export type JobOrdersData = Awaited<ReturnType<typeof getJobOrdersData>>
