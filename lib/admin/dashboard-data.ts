import { createAdminClient } from "@/lib/supabase/admin"
import { ACTIVE_JOB_STATUSES } from "@/lib/job-delay"

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

export async function getDelayedJobs() {
  const admin = createAdminClient()

  const { data } = await admin
    .from("job_order")
    .select(`
      id, status, expected_completion_at,
      service:service_id ( name )
    `)
    .or(
      `status.eq.Delayed,and(status.in.(${ACTIVE_STATUSES.map(s => `"${s}"`).join(",")}),expected_completion_at.lt.${new Date().toISOString()})`
    )
    .eq("is_archived", false)
    .order("expected_completion_at", { ascending: true })

  return (data ?? []) as unknown as {
    id: string
    status: string
    expected_completion_at: string | null
    service: { name: string } | null
  }[]
}

export async function getServiceBreakdown() {
  const admin = createAdminClient()

  const { data } = await admin
    .from("job_order")
    .select("service:service_id ( name )")
    .eq("is_archived", false)
    .in("status", [...ACTIVE_STATUSES, "Released"])

  const serviceCountMap: Record<string, number> = {}
  for (const row of (data ?? []) as unknown as { service: { name: string } | { name: string }[] | null }[]) {
    const svc = row.service
    const name = Array.isArray(svc) ? (svc[0]?.name ?? "Unknown") : (svc?.name ?? "Unknown")
    serviceCountMap[name] = (serviceCountMap[name] ?? 0) + 1
  }

  return Object.entries(serviceCountMap).map(([service_name, count]) => ({
    service_name,
    count,
  }))
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
