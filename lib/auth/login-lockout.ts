/**
 * Shared account-level lockout threshold/window — a wrong password
 * (app/api/auth/login/route.ts) and an exhausted MFA challenge
 * (app/api/auth/verify-mfa/route.ts) both trip the same lockout, so both
 * read these from one place instead of duplicating the magic numbers.
 */
export const LOCKOUT_THRESHOLD = 3
export const LOCKOUT_MS = 60_000
