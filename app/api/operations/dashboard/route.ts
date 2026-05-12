import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { addWorkingMins } from "@/hooks/time-utils"

export async function GET() {
  try {
    const supabase = createAdminClient()

    // All job orders with schedule fields
    const { data: jobs, error } = await supabase
      .from("job_order")
      .select(
        `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at,
         customer:customer_record_id(full_name),
         service:service_id(name)`
      )
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows   = jobs ?? []
    const jobIds = rows.map((j: any) => j.id)

    const ACTIVE_STATUSES = ["Pending", "Ongoing", "For Rework", "For Inspection", "For Release"]
    const activeJobs    = rows.filter((r: any) => ACTIVE_STATUSES.includes(r.status as string) && r.actual_start_at)
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

    // Auto-detect overdue — two signals, each job counted at most once
    const nowMs = Date.now()
    const overdueJobIds = new Set<string>()

    // Signal 1: job-level expected_completion_at
    for (const row of rows) {
      if (
        ACTIVE_STATUSES.includes(row.status as string) &&
        row.expected_completion_at &&
        new Date(row.expected_completion_at as string).getTime() < nowMs
      ) {
        overdueJobIds.add(row.id as string)
      }
    }

    // Signal 2: stage-level — check incomplete stages against cumulative expected end
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
        const sorted = [...stages].sort((a: any, b: any) =>
          ((a.service_stage as any)?.sequence_order ?? 0) - ((b.service_stage as any)?.sequence_order ?? 0)
        )
        const jobStart = new Date(startAt)
        let cumMins = 0
        for (const s of sorted) {
          const override = s.stage_duration_mins as number | null
          const base     = (s.service_stage as any)?.stage_duration_mins ?? 0
          const mins     = override != null ? override : base
          cumMins += mins
          if (mins > 0 && (s.status as string) !== "done") {
            if (nowMs > addWorkingMins(jobStart, cumMins).getTime()) {
              overdueJobIds.add(jobId)
              break
            }
          }
        }
      }
    }

    for (const _ of overdueJobIds) status_counts["delayed"]++

    // Recent jobs (latest 5)
    const recent_jobs = rows.slice(0, 5).map((r: any) => ({
      id:         r.id,
      display_id: `JO-${new Date(r.created_at).getFullYear()}-${(r.id as string).slice(-4).toUpperCase()}`,
      customer:   r.customer?.full_name ?? "Manual Entry",
      service:    r.service?.name ?? "—",
      status:     r.status,
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
          customer:               r.customer?.full_name ?? "Manual Entry",
          service:                r.service?.name ?? "—",
          head_detailer:          team.head_detailer,
          head_installer:         team.head_installer,
        }
      })

    return NextResponse.json({
      status_counts,
      concern_count: concern_count ?? 0,
      recent_jobs,
      calendar_jobs,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
