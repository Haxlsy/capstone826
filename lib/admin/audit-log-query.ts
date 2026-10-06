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

/**
 * Security Logs vs. Audit Trail is a category split, not an action-text
 * allow-list: every authentication/account-security event (login, logout,
 * lockout, failed attempts, password reset/change, …) is tagged category
 * "auth" — Security Logs shows only those rows, Audit Trail shows everything
 * else. See app/api/admin/audit-log/route.ts.
 */
export const SECURITY_CATEGORY = "auth"

/** Clicking a new column sorts it ascending; clicking the active column flips direction. */
export function toggleSort(
  current: { sortBy: AuditSortColumn; sortDir: AuditSortDir },
  column: AuditSortColumn,
): { sortBy: AuditSortColumn; sortDir: AuditSortDir } {
  if (current.sortBy !== column) return { sortBy: column, sortDir: "asc" }
  return { sortBy: column, sortDir: current.sortDir === "asc" ? "desc" : "asc" }
}
