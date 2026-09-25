/**
 * `/api/auth/session-status` reports why a session is no longer valid; the
 * login page needs the matching `?reason=` so it can explain it. Kept pure so
 * the mapping is tested rather than living inline in a hook.
 *
 * "mismatch" is a session that IS still valid, just superseded by a newer
 * login. "archived" is an admin having archived this account while it was in
 * use. Anything else (e.g. "no_session", the shape of a deliberate logout)
 * deliberately maps to no reason — the login page must not claim the user was
 * kicked out when they simply signed out.
 */
export type LoginRedirectReason = "signed_in_elsewhere" | "account_archived"

export function redirectReasonFor(statusReason: unknown): LoginRedirectReason | null {
  if (statusReason === "mismatch") return "signed_in_elsewhere"
  if (statusReason === "archived") return "account_archived"
  return null
}
