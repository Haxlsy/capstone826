import type { createAdminClient } from "@/lib/supabase/admin"
import { ACTIVE_JOB_STATUSES } from "@/lib/job-delay"

/**
 * Single source of truth for the Admin dashboard's "Popular Service" chart
 * (`ShopPerformanceChart`, title "Service Type Popularity"). Before this
 * existed, the server-rendered first paint (`lib/admin/dashboard-data.ts`)
 * and the API route hit on every period click (including "Overall") each
 * re-typed their own status list and grouping key, and disagreed with each
 * other — a job in "For Inspection" counted on first paint but vanished the
 * moment any period tab was clicked, and two services sharing one
 * `service_type` rendered as one bar or two depending on which code path ran.
 * Both now call this module so "Overall" is provably the same computation as
 * first paint.
 */

// The SSR path's already-correct list (every active status, plus Released —
// a finished job still counts toward "popular"). The API route used to
// hand-type a list that was missing "For Inspection".
export const SERVICE_BREAKDOWN_STATUSES: readonly string[] = [...ACTIVE_JOB_STATUSES, "Released"]

export interface ServiceLike {
  name: string
  service_type?: string | null
}

/** service_type is the chart's actual grouping key — falls back to the exact service name only when unset. */
export function serviceBreakdownLabel(service: ServiceLike | null | undefined): string {
  return service?.service_type?.trim() || service?.name || "Unknown"
}

/**
 * Groups job_order rows by `serviceBreakdownLabel` and sorts by count
 * descending — the business rule `service_breakdown_counts` (the SQL function
 * below actually runs) mirrors. Kept as a pure, tested reference even though
 * neither runtime caller fetches whole rows anymore — see
 * tests/service-breakdown.test.ts.
 */
export function computeServiceBreakdown(
  rows: { service: ServiceLike | ServiceLike[] | null }[],
): { service_name: string; count: number }[] {
  const countMap: Record<string, number> = {}
  for (const row of rows) {
    const svc = Array.isArray(row.service) ? row.service[0] : row.service
    const label = serviceBreakdownLabel(svc)
    countMap[label] = (countMap[label] ?? 0) + 1
  }
  return Object.entries(countMap)
    .map(([service_name, count]) => ({ service_name, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * The actual runtime path: counts and groups in Postgres
 * (`supabase/migrations/20260926000004_service_breakdown_rpc.sql`) instead of
 * fetching every matching job_order row into JS. Scales with the table
 * instead of degrading (and, past PostgREST's default max-rows cap,
 * silently undercounting) as job orders accumulate.
 */
export async function fetchServiceBreakdown(
  admin: ReturnType<typeof createAdminClient>,
  opts: { statuses: readonly string[]; since?: string | null },
): Promise<{ service_name: string; count: number }[]> {
  const { data, error } = await admin.rpc("service_breakdown_counts", {
    p_statuses: [...opts.statuses],
    p_since: opts.since ?? null,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as { service_name: string; count: number | string }[]).map((r) => ({
    service_name: r.service_name,
    count: Number(r.count),
  }))
}
