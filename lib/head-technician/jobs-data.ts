import { createAdminClient } from "@/lib/supabase/admin"
import { addWorkingMins } from "@/hooks/time-utils"
import { fmtDate } from "@/lib/time-display"

export type TechnicianJob = {
  job_id: string
  raw_id: string
  customer_name: string
  plate_number: string
  car_make: string
  car_color: string
  service: string
  technician_name: string
  scheduled_start: string
  status: string
  progress: number
  stage_groups: { label: string; color: string; done: number; total: number }[]
  has_delayed_stage: boolean
}

type StageGroup = { label: string; color: string; done: number; total: number }
type SSRow = { id: string; category_id: string | null; stage_duration_mins?: number | null; sequence_order?: number | null }
type CatRow = { id: string; name: string; display_color: string; technician_role: string }

export async function getHeadTechnicianJobs(userId: string) {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from("user_account")
    .select("full_name, role")
    .eq("id", userId)
    .single()

  if (!profile) throw new Error("Profile not found")

  const role = profile.role as string
  if (role !== "head_detailer" && role !== "head_installer") {
    return { jobs: [] as TechnicianJob[], userRole: role, displayName: profile.full_name }
  }

  const { data: teamRows } = await admin
    .from("job_order_team")
    .select("job_order_id")
    .eq("user_account_id", userId)

  const jobIds = (teamRows ?? []).map((t: any) => t.job_order_id)
  if (jobIds.length === 0) {
    return { jobs: [] as TechnicianJob[], userRole: role, displayName: profile.full_name }
  }

  // These three only depend on jobIds, not on each other — run concurrently
  // instead of paying for three sequential round-trips.
  const [{ data: jobs, error }, { data: allTeam }, { data: stageProg }] = await Promise.all([
    admin
      .from("job_order")
      .select(`
        id, status, scheduled_at, actual_start_at, created_at, job_order_code,
        customer:customer_record_id(full_name, plate_number, vehicle_unit),
        service:service_id(name),
        customer_name, plate_number, vehicle_unit
      `)
      .in("id", jobIds)
      .not("status", "in", '("Released","Cancelled")')
      .order("scheduled_at", { ascending: true }),
    admin
      .from("job_order_team")
      .select("job_order_id, role_in_job, user_account:user_account_id(full_name)")
      .in("job_order_id", jobIds),
    admin
      .from("job_stage_progress")
      .select("job_order_id, status, service_stage_id, stage_duration_mins")
      .in("job_order_id", jobIds),
  ])

  if (error) throw new Error(error.message)

  const ssIds = [...new Set((stageProg ?? []).map((s: any) => s.service_stage_id as string).filter(Boolean))]
  let ssRows: SSRow[] = []
  if (ssIds.length > 0) {
    const { data } = await admin
      .from("service_stage")
      .select("id, category_id, stage_duration_mins, sequence_order")
      .in("id", ssIds)
    ssRows = (data ?? []) as SSRow[]
  }
  const ssMap = new Map(ssRows.map((r) => [r.id, r]))

  const catIds = [...new Set(ssRows.map((r) => r.category_id).filter(Boolean) as string[])]
  let catRows: CatRow[] = []
  if (catIds.length > 0) {
    const { data } = await admin
      .from("workflow_category")
      .select("id, name, display_color, technician_role")
      .in("id", catIds)
    catRows = (data ?? []) as CatRow[]
  }
  const catMap = new Map(catRows.map((r) => [r.id, r]))

  const groupsMap = new Map<string, Map<string, StageGroup>>()
  const jobStagesMap = new Map<string, any[]>()

  for (const s of stageProg ?? []) {
    if (!jobStagesMap.has(s.job_order_id)) jobStagesMap.set(s.job_order_id, [])
    jobStagesMap.get(s.job_order_id)!.push(s)

    const ss = s.service_stage_id ? ssMap.get(s.service_stage_id) : null
    if (!ss?.category_id) continue
    const cat = catMap.get(ss.category_id)
    if (!cat) continue

    if (!groupsMap.has(s.job_order_id)) groupsMap.set(s.job_order_id, new Map())
    const jobGroups = groupsMap.get(s.job_order_id)!
    if (!jobGroups.has(cat.id)) {
      jobGroups.set(cat.id, { label: cat.name, color: cat.display_color, done: 0, total: 0 })
    }
    const g = jobGroups.get(cat.id)!
    g.total++
    if ((s as any).status === "done") g.done++
  }

  const nowMs = Date.now()
  const delayedJobIds = new Set<string>()
  for (const j of jobs ?? []) {
    if (!j.actual_start_at) continue
    const stages = jobStagesMap.get(j.id) ?? []
    const sorted = [...stages].sort((a: any, b: any) => {
      const ssA = a.service_stage_id ? ssMap.get(a.service_stage_id) : null
      const ssB = b.service_stage_id ? ssMap.get(b.service_stage_id) : null
      return ((ssA?.sequence_order ?? 0) as number) - ((ssB?.sequence_order ?? 0) as number)
    })
    const jobStart = new Date(j.actual_start_at as string)
    let cumMins = 0
    for (const s of sorted) {
      const ss = s.service_stage_id ? ssMap.get(s.service_stage_id) : null
      const override = (s as any).stage_duration_mins as number | null
      const base = ss?.stage_duration_mins ?? 0
      const mins = override != null ? override : base
      cumMins += mins
      if (mins > 0 && (s.status as string) !== "done" && (s.status as string) !== "for_rework") {
        if (nowMs > addWorkingMins(jobStart, cumMins).getTime()) {
          delayedJobIds.add(j.id as string)
          break
        }
      }
    }
  }

  const result = (jobs ?? []).map((j: any) => {
    const jobGroups = groupsMap.get(j.id)
    const stageGroups: StageGroup[] = jobGroups ? [...jobGroups.values()] : []
    const totalDone = stageGroups.reduce((a, g) => a + g.done, 0)
    const totalAll = stageGroups.reduce((a, g) => a + g.total, 0)

    const member = (allTeam ?? []).find(
      (t: any) => t.job_order_id === j.id && t.role_in_job === role
    )
    return {
      job_id: j.job_order_code,
      raw_id: j.id as string,
      customer_name: (j.customer as any)?.full_name ?? j.customer_name ?? "—",
      plate_number: (j.customer as any)?.plate_number ?? j.plate_number ?? "—",
      car_make: (j.customer as any)?.vehicle_unit ?? j.vehicle_unit ?? "—",
      car_color: "",
      service: (j.service as any)?.name ?? "—",
      technician_name: (member?.user_account as any)?.full_name ?? "Unassigned",
      scheduled_start: fmtDate(j.scheduled_at),
      status: j.status,
      progress: totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0,
      stage_groups: stageGroups,
      has_delayed_stage: delayedJobIds.has(j.id as string),
    }
  })

  return { jobs: result, userRole: role, displayName: profile.full_name }
}
