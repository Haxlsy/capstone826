/**
 * Copy for the login page's redirect-reason explanation (`?reason=...`,
 * set by proxy.ts / hooks/useSessionEnforcement.ts when a stale session is
 * sent back here). Kept as one pure mapping so the toast (immediate, but can
 * fire and auto-dismiss on a tab nobody is watching) and the persistent
 * banner (kept on screen until dismissed) can never drift out of sync with
 * each other — see components/LoginPage.tsx.
 */
export type LoginRedirectNotice = "signed_in_elsewhere" | "session_expired" | "idle_timeout" | "account_archived"

const NOTICE_COPY: Record<LoginRedirectNotice, string> = {
  signed_in_elsewhere: "You were signed out because your account signed in on another device.",
  idle_timeout: "You were signed out due to inactivity.",
  account_archived: "This account has been archived. Please contact an administrator.",
  session_expired: "Your session has ended — please sign in again.",
}

export function isLoginRedirectNotice(reason: unknown): reason is LoginRedirectNotice {
  return typeof reason === "string" && reason in NOTICE_COPY
}

export function loginRedirectNoticeCopy(reason: LoginRedirectNotice): string {
  return NOTICE_COPY[reason]
}
