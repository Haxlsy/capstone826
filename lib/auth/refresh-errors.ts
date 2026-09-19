/**
 * True when a Supabase Auth error means this session can never recover — the
 * refresh token was deleted or already consumed, or the session no longer
 * exists — as opposed to a transient failure (network blip, Auth outage) that
 * a retry could fix. Shared by proxy.ts and the client-side session hook so
 * both agree on exactly when to clear the session and send the user to /login.
 *
 * Deliberately conservative: an ambiguous error returns false, because
 * treating a blip as a dead session would sign people out for no reason.
 */
const DEAD_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
])

export function isDeadSessionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const { name, code, message } = err as { name?: unknown; code?: unknown; message?: unknown }

  if (name === "AuthRetryableFetchError") return false
  if (typeof code === "string" && DEAD_CODES.has(code)) return true
  return typeof message === "string" && /refresh token/i.test(message)
}
