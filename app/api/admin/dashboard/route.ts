import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ACTIVE_JOB_STATUSES } from "@/lib/job-delay"

const ACTIVE_STATUSES: readonly string[] = ACTIVE_JOB_STATUSES

// GET /api/admin/dashboard
// Returns aggregated stats for the admin dashboard.
export async function GET() {
  try {
    const admin = createAdminClient()

    const [
      activeJobsResult,
      shopConfigResult,
      chatbotCountResult,
      humanEscalationResult,
      delayedJobsResult,
      serviceBreakdownResult,
      techniciansResult,
    ] = await Promise.all([
      // Active job count
      admin
        .from("job_order")
        .select("id", { count: "exact", head: true })
        .in("status", ACTIVE_STATUSES)
        .eq("is_archived", false),

      // Max capacity from shop_config
      admin
        .from("shop_config")
        .select("max_capacity")
        .eq("id", 1)
        .single(),

      // All inquiries (total)
      admin
        .from("inquiry")
        .select("id", { count: "exact", head: true }),

      // Human-escalated inquiries
      admin
        .from("inquiry")
        .select("id", { count: "exact", head: true })
        .eq("inquiry_type", "Human Response"),

      // Delayed jobs: status='Delayed' OR (active + past expected_completion_at)
      admin
        .from("job_order")
        .select(`
          id,
          status,
          expected_completion_at,
          service:service_id ( name )
        `)
        .or(
          `status.eq.Delayed,and(status.in.(${ACTIVE_STATUSES.map(s => `"${s}"`).join(",")}),expected_completion_at.lt.${new Date().toISOString()})`
        )
        .eq("is_archived", false)
        .order("expected_completion_at", { ascending: true }),

      // Service breakdown: count of non-archived job_orders per service
      admin
        .from("job_order")
        .select("service:service_id ( name )")
        .eq("is_archived", false)
        .in("status", [...ACTIVE_STATUSES, "Released"]),

      // Technician availability
      admin
        .from("technician")
        .select("id, full_name, role, is_available")
        .eq("is_archived", false)
        .order("role")
        .order("full_name"),
    ])

    // Surface any errors
    for (const result of [activeJobsResult, shopConfigResult, chatbotCountResult, humanEscalationResult, delayedJobsResult, serviceBreakdownResult, techniciansResult]) {
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 })
      }
    }

    const total = chatbotCountResult.count ?? 0
    const escalated = humanEscalationResult.count ?? 0
    const chatbotEfficiency = total === 0 ? 0 : Math.round(((total - escalated) / total) * 100)

    // Aggregate service breakdown
    const serviceCountMap: Record<string, number> = {}
    for (const row of (serviceBreakdownResult.data ?? []) as unknown as { service: { name: string } | { name: string }[] | null }[]) {
      const svc = row.service
      const name = Array.isArray(svc) ? (svc[0]?.name ?? "Unknown") : (svc?.name ?? "Unknown")
      serviceCountMap[name] = (serviceCountMap[name] ?? 0) + 1
    }
    const serviceBreakdown = Object.entries(serviceCountMap).map(([service_name, count]) => ({
      service_name,
      count,
    }))

    return NextResponse.json({
      activeJobCount: activeJobsResult.count ?? 0,
      maxCapacity: shopConfigResult.data?.max_capacity ?? 15,
      chatbotEfficiency,
      delayedJobs: delayedJobsResult.data ?? [],
      serviceBreakdown,
      technicians: techniciansResult.data ?? [],
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
