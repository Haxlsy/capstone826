export interface HrefNotification {
  type: string
  job_order_id: string | null
  inquiry_id: string | null
  concern_id?: string | null
}

/**
 * Where clicking a notification goes. The same job_order_id means a different
 * route depending on who's looking. Order matters: a "concern" notification
 * also carries its job's id, but must open the concern, not the job.
 *
 * - "concern" (Operations, from a head tech's report) → that concern's drawer
 *   (older rows without a concern_id open the Concerns list).
 * - "concern_resolved" (head tech, once Operations resolves their report) →
 *   that concern on the head tech's own Concerns page (older rows without a
 *   concern_id open the Concerns list).
 * - "inquiry" (Sales, Messenger escalation) → that inquiry, else the Sales page.
 */
export function getNotificationHref(n: HrefNotification, role: string): string | null {
  if (n.type === "concern") {
    return n.concern_id ? `/dashboard/concerns?concern=${n.concern_id}` : "/dashboard/concerns"
  }
  if (n.type === "concern_resolved") {
    return n.concern_id ? `/head-technician/concerns?concernId=${n.concern_id}` : "/head-technician/concerns"
  }
  if (n.job_order_id) {
    if (role === "sales") return `/dashboard/sales/jobs/${n.job_order_id}`
    if (role === "head_detailer" || role === "head_installer") return `/head-technician/${n.job_order_id}`
    return `/dashboard/job-management/${n.job_order_id}` // operations, admin, super_admin
  }
  if (n.type === "inquiry") {
    return n.inquiry_id ? `/dashboard/sales?inquiry=${n.inquiry_id}` : "/dashboard/sales"
  }
  return null
}
