import {createAdminClient} from '@/lib/supabase/admin'
import { ACTIVE_JOB_STATUSES, isJobDelayed, computeStageDelays, hasAnyStageDelayed, type StageForDelay } from '@/lib/job-delay'

export async function getDashboardData(){
       const supabase = createAdminClient()

    // All job orders with schedule fields
    const { data: jobs} = await supabase
      .from("job_order")
      .select(
        `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at, updated_at, job_order_code,
         customer:customer_record_id(full_name),
         service:service_id(name)`
      )
      .order("created_at", { ascending: false })


    const rows   = jobs ?? []
    const jobIds = rows.map((j: any) => j.id)

    const activeJobs    = rows.filter((r: any) => (ACTIVE_JOB_STATUSES as readonly string[]).includes(r.status) && r.actual_start_at)
    const activeJobIds  = activeJobs.map((r: any) => r.id as string)

    // Run remaining queries in parallel
    const [teamResult, stageResult, concernResult] = await Promise.all([
      supabase
        .from("job_order_team")
        .select("job_order_id, role_in_job, user_account:user_account_id(full_name)")
        .in("job_order_id", jobIds)
        .in("role_in_job", ["head_detailer", "head_installer"]),

      activeJobIds.length > 0
        ? supabase
            .from("job_stage_progress")
            .select("job_order_id, status, stage_duration_mins, service_stage:service_stage_id(stage_duration_mins, sequence_order)")
            .in("job_order_id", activeJobIds)
        : Promise.resolve({ data: [] }),

      supabase
        .from("concern")
        .select("id", { count: "exact", head: true })
        .eq("status", "Pending"),
    ])

    const teamRows = teamResult.data ?? []
    const stageRows = stageResult.data ?? []
    const concern_count = concernResult.count

    const teamMap = new Map<string, { head_detailer: string | null; head_installer: string | null }>()
    for (const t of teamRows) {
      const entry = teamMap.get(t.job_order_id) ?? { head_detailer: null, head_installer: null }
      const name  = (t.user_account as any)?.full_name ?? null
      if (t.role_in_job === "head_detailer")  entry.head_detailer  = name
      if (t.role_in_job === "head_installer") entry.head_installer = name
      teamMap.set(t.job_order_id, entry)
    }

    // Status counts — keys normalised to snake_case to match the frontend STATUS_CONFIG keys
    const STATUS_LABEL_TO_KEY: Record<string, string> = {
      "Pending":    "pending",
      "Ongoing":    "ongoing",
      "For Rework": "for_rework",
      "For Inspection":"for_inspection",
      "For Release":   "for_release",
      "Delayed":    "delayed",
      "Cancelled":  "cancelled",
    }
    const status_counts: Record<string, number> = Object.fromEntries(
      Object.values(STATUS_LABEL_TO_KEY).map((k) => [k, 0])
    )
    for (const row of rows) {
      const key = STATUS_LABEL_TO_KEY[row.status as string]
      if (key) status_counts[key]++
    }

    // Auto-detect overdue — two signals, each job counted at most once. Both
    // go through lib/job-delay.ts, the single shared definition of "delayed"
    // every other surface (Admin, Head Detailer/Installer) also uses.
    const overdueJobIds = new Set<string>()

    // Signal 1: job-level expected_completion_at (isJobDelayed) — checked
    // against every active-status row, NOT just `activeJobs` (which also
    // requires actual_start_at, a condition isJobDelayed itself never asks
    // for). A job that was scheduled but never started (still "Pending", no
    // actual_start_at) can still blow its expected_completion_at — that case
    // must count here too, matching Admin's getDelayedJobs() and this same
    // file's recent_jobs/calendar_jobs below, which already check every row.
    const activeStatusRows = rows.filter((r: any) => (ACTIVE_JOB_STATUSES as readonly string[]).includes(r.status))
    for (const row of activeStatusRows) {
      if (isJobDelayed(row as { status: string; expected_completion_at: string | null })) {
        overdueJobIds.add(row.id as string)
      }
    }

    // Signal 2: stage-level — any incomplete stage past its cumulative expected end.
    if (stageRows.length > 0) {
      const jobStagesMap = new Map<string, any[]>()
      for (const s of stageRows) {
        if (!jobStagesMap.has(s.job_order_id)) jobStagesMap.set(s.job_order_id, [])
        jobStagesMap.get(s.job_order_id)!.push(s)
      }
      const startMap = new Map(activeJobs.map((r: any) => [r.id as string, r.actual_start_at as string]))

      for (const [jobId, stages] of jobStagesMap) {
        if (overdueJobIds.has(jobId)) continue
        const startAt = startMap.get(jobId)
        if (!startAt) continue
        const shaped: StageForDelay[] = stages.map((s: any, idx: number) => ({
          id: String(idx),
          status: s.status,
          sequence_order: (s.service_stage as any)?.sequence_order ?? 0,
          stage_duration_mins: s.stage_duration_mins,
          service_stage_duration_mins: (s.service_stage as any)?.stage_duration_mins ?? null,
        }))
        if (hasAnyStageDelayed(computeStageDelays(shaped, startAt))) {
          overdueJobIds.add(jobId)
        }
      }
    }

    for (const _ of overdueJobIds) status_counts["delayed"]++

    // Recent jobs — last touched (updated_at), not last created, and excludes
    // jobs that are already finished (nothing left to keep an eye on there).
    const FINISHED_STATUSES = ["Released", "Cancelled"]
    const recent_jobs = rows
      .filter((r: any) => !FINISHED_STATUSES.includes(r.status as string))
      .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
      .map((r: any) => ({
        id:         r.id,
        display_id: r.job_order_code,
        customer:   r.customer?.full_name ?? "Manual Entry",
        service:    r.service?.name ?? "—",
        status:     r.status,
        is_overdue: isJobDelayed(r),
        created_at: r.created_at,
      }))

    // Calendar jobs — enriched with timing + team
    const calendar_jobs = rows
      .filter((r: any) => r.scheduled_at)
      .map((r: any) => {
        const team = teamMap.get(r.id) ?? { head_detailer: null, head_installer: null }
        return {
          id:                     r.id,
          scheduled_at:           r.scheduled_at,
          actual_start_at:        r.actual_start_at,
          expected_completion_at: r.expected_completion_at,
          status:                 r.status,
          is_overdue:             isJobDelayed(r),
          customer:               r.customer?.full_name ?? "Manual Entry",
          service:                r.service?.name ?? "—",
          head_detailer:          team.head_detailer,
          head_installer:         team.head_installer,
        }
      })

    return {
      status_counts,
      concern_count: concern_count ?? 0,
      recent_jobs,
      calendar_jobs,
    }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>