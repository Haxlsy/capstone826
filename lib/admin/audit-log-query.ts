/**
 * Validated inputs for GET /api/admin/audit-log. Every value here is an
 * allow-list check — nothing from the request's query string is ever passed
 * straight to a Supabase `.order()`/`.eq()` call.
 */
export const AUDIT_SORT_COLUMNS = ["created_at", "user_name", "role", "action", "target"] as const
export type AuditSortColumn = typeof AUDIT_SORT_COLUMNS[number]

export function isAuditSortColumn(value: unknown): value is AuditSortColumn {
  return typeof value === "string" && (AUDIT_SORT_COLUMNS as readonly string[]).includes(value)
}

export type AuditSortDir = "asc" | "desc"

export function isAuditSortDir(value: unknown): value is AuditSortDir {
  return value === "asc" || value === "desc"
}

export type AuditScope = "activity" | "security"

export function isAuditScope(value: unknown): value is AuditScope {
  return value === "activity" || value === "security"
}

/** The two literal event actions Security Logs scopes itself to. */
export const SECURITY_EVENT_ACTIONS = ["Logged in", "Logged out"] as const

/** Clicking a new column sorts it ascending; clicking the active column flips direction. */
export function toggleSort(
  current: { sortBy: AuditSortColumn; sortDir: AuditSortDir },
  column: AuditSortColumn,
): { sortBy: AuditSortColumn; sortDir: AuditSortDir } {
  if (current.sortBy !== column) return { sortBy: column, sortDir: "asc" }
  return { sortBy: column, sortDir: current.sortDir === "asc" ? "desc" : "asc" }
}
