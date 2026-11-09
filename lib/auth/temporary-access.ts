/**
 * Temporary Head Technician access — a technician made head for one job, one
 * day, by Operations (see app/api/operations/job-orders/[id]/temporary-head).
 * Pure helpers, shared by the server route, the access checks and the UI.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000 // Asia/Manila is UTC+8, no DST

/** 23:59:59.999 today in Manila, as an absolute instant (a UTC Date). */
export function endOfManilaDay(now: Date = new Date()): Date {
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS)
  const endUtcClock = Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate(), 23, 59, 59, 999)
  return new Date(endUtcClock - MANILA_OFFSET_MS)
}

/** Whether an account's temporary access has run out. No expiry = never expires. */
export function isAccessExpired(
  account: { access_expires_at?: string | Date | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  const at = account?.access_expires_at
  if (!at) return false
  const expires = at instanceof Date ? at : new Date(at)
  return !Number.isNaN(expires.getTime()) && expires.getTime() <= now.getTime()
}

/**
 * The short tag shown next to a Temporary Head Technician (Operations' job
 * Team box): still active today, or access already ended. `null` for a regular
 * account, so callers can render the tag only when there is one.
 */
export function temporaryHeadTag(
  account: { is_temporary_head?: boolean | null; access_expires_at?: string | Date | null } | null | undefined,
  now: Date = new Date(),
): { label: string; ended: boolean } | null {
  if (!account?.is_temporary_head) return null
  const ended = isAccessExpired(account, now)
  return { label: ended ? "Temporary · access ended" : "Temporary · until 11:59 PM", ended }
}

/**
 * The single status shown for an account in Admin's Account Management:
 * archived wins; a temporary head shows its temporary tag instead of "Active"
 * (an expired one can't log in, so "Active" would be wrong); everyone else is
 * Active.
 */
export function accountStatusBadge(
  account: { is_archived?: boolean | null; is_temporary_head?: boolean | null; access_expires_at?: string | Date | null },
  now: Date = new Date(),
): { kind: "archived" | "temporary" | "active"; label: string; ended?: boolean } {
  if (account.is_archived) return { kind: "archived", label: "Archived" }
  const tag = temporaryHeadTag(account, now)
  if (tag) return { kind: "temporary", label: tag.label, ended: tag.ended }
  return { kind: "active", label: "Active" }
}

/** Same rule as AddAccountModal's suggested username: no spaces, lowercase. */
function slug(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase()
}

/**
 * `first.last` for a new temporary head login; `first.last2`, `first.last3`…
 * when it's already taken (`taken` compared case-insensitively). Empty when
 * either name part is empty.
 */
export function tempHeadUsername(first: string, last: string, taken: Iterable<string> = []): string {
  const base = `${slug(first)}.${slug(last)}`
  if (!slug(first) || !slug(last)) return ""
  const used = new Set([...taken].map((u) => u.toLowerCase()))
  if (!used.has(base)) return base
  for (let n = 2; ; n++) {
    if (!used.has(`${base}${n}`)) return `${base}${n}`
  }
}

// No 0/O, 1/l/I — the password is read out loud, so nothing ambiguous.
// Same alphabet as app/api/admin/reset-password's generatePassword.
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"

/** A 10-character temporary password that's easy to read out and type. */
export function generateTempPassword(length = 10): string {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("")
}

export const TEMP_PASSWORD_CHARS = PASSWORD_CHARS

/** Crew role → the head role they cover. */
export function headRoleForCrew(role: string): "head_detailer" | "head_installer" | null {
  if (role === "detailer") return "head_detailer"
  if (role === "installer") return "head_installer"
  return null
}
