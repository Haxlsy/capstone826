/**
 * Allow-list for POST /api/audit/log-export. A client can only ever select
 * one of these fixed export types — never supply its own category/action/
 * target-free text — so it can log "I exported this kind of thing" but never
 * forge an arbitrary audit entry. Mirrors lib/audit/view-types.ts.
 */
export const EXPORT_TYPE_ACTIONS = {
  audit_trail_pdf:          "Exported audit trail (PDF)",
  audit_trail_excel:        "Exported audit trail (Excel)",
  security_logs_pdf:        "Exported security logs (PDF)",
  security_logs_excel:      "Exported security logs (Excel)",
  job_order_detail_pdf:     "Exported job order (PDF)",
  job_order_detail_excel:   "Exported job order (Excel)",
  job_order_records_pdf:    "Exported job order records (PDF)",
  job_order_records_excel:  "Exported job order records (Excel)",
  customer_records_pdf:     "Exported customer records (PDF)",
  customer_records_excel:   "Exported customer records (Excel)",
} as const

export type ExportType = keyof typeof EXPORT_TYPE_ACTIONS

export function isExportType(value: unknown): value is ExportType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EXPORT_TYPE_ACTIONS, value)
}
