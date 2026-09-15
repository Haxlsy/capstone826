import type { SupabaseClient } from "@supabase/supabase-js"

// job_status enum minus the two terminal states (Released/Cancelled) — a
// service referenced only by a finished/cancelled job order is safe to
// archive or edit again. Shared between the services list (drives the
// "In Use" badge) and the PATCH route's archive/edit guard.
export const LIVE_JOB_STATUSES = ["Pending", "Ongoing", "For Rework", "For Release", "Delayed"] as const

export interface LiveJobOrderRef {
  id: string
  job_order_code: string
  customer_name: string | null
  status: string
}

/**
 * Job orders in a live (in-progress) status that reference this service —
 * used to block archiving/editing a service that's currently in use, and to
 * name the affected job orders in the resulting error. Capped at 5; callers
 * only need this for a short "these job orders are using it" message, not a
 * full list.
 */
export async function getLiveJobOrdersForService(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client generic typing isn't worth threading through here
  supabase: SupabaseClient<any>,
  serviceId: string,
): Promise<LiveJobOrderRef[]> {
  const { data } = await supabase
    .from("job_order")
    .select("id, job_order_code, customer_name, status")
    .eq("service_id", serviceId)
    .in("status", LIVE_JOB_STATUSES)
    .limit(5)

  return (data ?? []) as LiveJobOrderRef[]
}
