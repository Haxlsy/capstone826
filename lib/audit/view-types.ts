/**
 * Allow-list for POST /api/audit/log-view. A client can only ever select one
 * of these fixed view types — never supply its own category/action/target-free
 * text — so it can log "I viewed this kind of thing" but never forge an
 * arbitrary audit entry.
 */
export const VIEW_TYPE_ACTIONS = {
  account:           "Viewed account details",
  customer_record:   "Viewed customer record details",
  inquiry:           "Viewed inquiry details",
  job_concern:       "Viewed job concern details",
  chatbot_knowledge: "Viewed chatbot knowledge entry",
} as const

export type ViewType = keyof typeof VIEW_TYPE_ACTIONS

export function isViewType(value: unknown): value is ViewType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(VIEW_TYPE_ACTIONS, value)
}
