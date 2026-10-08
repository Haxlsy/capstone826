/**
 * Email validation shared by the account-creation form and its API routes,
 * so the client-side message and the server-side gate can't drift apart —
 * mirrors lib/name.ts's own validate/normalize pattern.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Trims and lowercases — email addresses are case-insensitive for our purposes. */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase()
}

/**
 * Returns an error message when the email is unusable, or `null` when it's fine.
 * `label` names the field in the message, e.g. "Email".
 */
export function validateEmail(raw: string | null | undefined, label = "Email"): string | null {
  const value = normalizeEmail(raw)
  if (!value) return `${label} is required.`
  if (value.length > 254) return `${label} must be 254 characters or fewer.`
  if (!EMAIL_PATTERN.test(value)) {
    return `${label} must be a valid email address.`
  }
  return null
}
