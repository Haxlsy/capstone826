import { createAdminClient } from "@/lib/supabase/admin"
import { ACTIVE_JOB_STATUSES, isJobDelayed } from "@/lib/job-delay"
import { loadStageDelayedSince } from "@/lib/job-delay-data"
import { SERVICE_BREAKDOWN_STATUSES, fetchServiceBreakdown } from "@/lib/admin/service-breakdown"

const ACTIVE_STATUSES: readonly string[] = ACTIVE_JOB_STATUSES

export async function getDashboardSummary() {
  const admin = createAdminClient()

  const [activeJobsResult, shopConfigResult, chatbotCountResult, humanEscalationResult] =
    await Promise.all([
      admin
        .from("job_order")
        .select("id", { count: "exact", head: true })
        .in("status", ACTIVE_STATUSES)
        .eq("is_archived", false),
      admin
        .from("shop_config")
        .select("max_capacity")
        .eq("id", 1)
        .single(),
      admin
        .from("inquiry")
        .select("id", { count: "exact", head: true }),
      admin
        .from("inquiry")
        .select("id", { count: "exact", head: true })
        .eq("inquiry_type", "Human Response"),
    ])

  const total = chatbotCountResult.count ?? 0
  const escalated = humanEscalationResult.count ?? 0
  const chatbotEfficiency = total === 0 ? 0 : Math.round(((total - escalated) / total) * 100)

  return {
    activeJobCount: activeJobsResult.count ?? 0,
    maxCapacity: shopConfigResult.data?.max_capacity ?? 15,
    chatbotEfficiency,
  }
}

export interface DelayedJob {
  id: string
  job_order_code: string
  status: string
  expected_completion_at: string | null
  service: { name: string } | null
  /** "job": past its estimated completion. "stage": a stage is behind schedule. */
  delay_reason: "job" | "stage"
  /** When it fell behind: the estimated completion, or the late stage's expected end. */
  delayed_since: string | null
}

/**
 * Jobs that are delayed by the same combined rule Operations' dashboard uses
 * (lib/job-delay.ts): past the job's estimated completion, OR a started job
 * with a stage past its own expected end. This used to check only the first,
 * so a job Operations showed as delayed could be missing here for a day.
 */
export async function getDelayedJobs(): Promise<DelayedJob[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("job_order")
    .select(`
      id, job_order_code, status, expected_completion_at, actual_start_at,
      service:service_id ( name )
    `)
    .in("status", [...ACTIVE_STATUSES, "Delayed"])
    .eq("is_archived", false)

  // An empty table must not be mistaken for "nothing is delayed" in the logs.
  if (error) console.error("[admin/dashboard] delayed jobs query failed:", error.message)

  const rows = (data ?? []) as unknown as {
    id: string
    job_order_code: string
    status: string
    expected_completion_at: string | null
    actual_start_at: string | null
    service: { name: string } | null
  }[]

  const lateStage = await loadStageDelayedSince(admin, rows)

  const delayed: DelayedJob[] = []
  for (const r of rows) {
    const base = {
      id: r.id,
      job_order_code: r.job_order_code,
      status: r.status,
      expected_completion_at: r.expected_completion_at,
      service: r.service,
    }
    if (isJobDelayed(r)) {
      delayed.push({ ...base, delay_reason: "job", delayed_since: r.expected_completion_at })
    } else if (lateStage.has(r.id)) {
      delayed.push({ ...base, delay_reason: "stage", delayed_since: lateStage.get(r.id)! })
    }
  }

  // Longest delay first; rows with no date (legacy "Delayed" status) last.
  return delayed.sort((a, b) => (a.delayed_since ?? "9999").localeCompare(b.delayed_since ?? "9999"))
}

export async function getServiceBreakdown() {
  const admin = createAdminClient()

  // Status list and grouping are shared with the API route the chart's period
  // tabs call (see lib/admin/service-breakdown.ts) — this is the "Overall"
  // view before any tab is clicked, so it must compute the identical thing.
  // Counted in Postgres (service_breakdown_counts), not fetched row-by-row.
  return fetchServiceBreakdown(admin, { statuses: SERVICE_BREAKDOWN_STATUSES })
}

export async function getTechnicians() {
  const admin = createAdminClient()

  const { data } = await admin
    .from("technician")
    .select("id, full_name, role, is_available")
    .eq("is_archived", false)
    .order("role")
    .order("full_name")

  return (data ?? []) as {
    id: string
    full_name: string
    role: string
    is_available: boolean
  }[]
}
