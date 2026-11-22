// Data retention: the date rules, as pure functions (no database, no clock of
// their own), so they can be unit-tested and shared by the daily job, the
// list pages' "Expiring soon" filters and the badges.
// Background: docs/task/panel-recommendations.md, section 4.
//
// Each record has an ANCHOR: the moment its clock starts (a job's release, an
// inquiry's resolution, a customer's last activity, an archive date...).
//
//   deletion date = the later of
//     - anchor + the retention period (calendar months), and
//     - the last period change + 14 days (the safety rule)
//
// A record is deleted on the first daily run on or after that date.

import { RETENTION_CHANGE_GRACE_DAYS } from "./config"

const DAY_MS = 24 * 60 * 60 * 1000

export interface RetentionPolicy {
  /** The period, in months (shop_config.retention_months). */
  months: number
  /** When the period was last changed (shop_config.retention_changed_at). */
  changedAt: string | Date | null
}

/** The weekly digest announces deletions 7 to 14 days ahead. */
export const DIGEST_LEAD_DAYS = 7
export const DIGEST_SPAN_DAYS = 7
/** Badges and the "Expiring soon" filter look this far ahead. */
export const EXPIRING_SOON_DAYS = 30

const toDate = (d: string | Date) => (d instanceof Date ? d : new Date(d))

/**
 * `date` moved by whole calendar months, keeping the time of day. Clamps to
 * the month's last day (Aug 31 + 6 months = Feb 28/29), as calendars do.
 */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d
}

/** The end of the 14-day safety period after the last change, or null. */
export function graceEnd(policy: RetentionPolicy): Date | null {
  if (!policy.changedAt) return null
  return new Date(toDate(policy.changedAt).getTime() + RETENTION_CHANGE_GRACE_DAYS * DAY_MS)
}

/** When a record with this anchor will be deleted. */
export function deletionDate(anchor: string | Date, policy: RetentionPolicy): Date {
  const byAge = addMonths(toDate(anchor), policy.months)
  const grace = graceEnd(policy)
  return grace && grace > byAge ? grace : byAge
}

/**
 * Records whose anchor is at or before this are due for deletion at `now`;
 * null while the safety period is running (nothing is due then).
 *
 * Note: going back N months from `now` can land a day or two later than
 * going forward N months from the anchor at month ends (clamping), so a
 * record is never deleted BEFORE the date shown for it, at most a day after.
 */
export function dueCutoff(policy: RetentionPolicy, now: Date): Date | null {
  const grace = graceEnd(policy)
  if (grace && now < grace) return null
  return addMonths(now, -policy.months)
}

/** Whether a record with this anchor is due for deletion at `now`. */
export function isDue(anchor: string | Date, policy: RetentionPolicy, now: Date): boolean {
  const cutoff = dueCutoff(policy, now)
  return cutoff !== null && toDate(anchor) <= cutoff
}

/** Whole days from `now` until this record's deletion date (0 or less = due). */
export function daysUntilDeletion(anchor: string | Date, policy: RetentionPolicy, now: Date): number {
  return Math.ceil((deletionDate(anchor, policy).getTime() - now.getTime()) / DAY_MS)
}

/** Whether a record is within `days` of deletion: the "Expiring soon" rule. */
export function isExpiringSoon(
  anchor: string | Date | null | undefined,
  policy: RetentionPolicy,
  now: Date,
  days = EXPIRING_SOON_DAYS,
): boolean {
  if (!anchor) return false
  return deletionDate(anchor, policy).getTime() <= now.getTime() + days * DAY_MS
}

/**
 * Upper anchor bound for "deleted within the next `days`": every record whose
 * anchor is at or before this, and only those, may be in that window. Used to
 * narrow database queries; apply `isExpiringSoon` to the rows for the exact
 * answer.
 */
export function expiringAnchorBound(policy: RetentionPolicy, now: Date, days = EXPIRING_SOON_DAYS): Date | null {
  const horizon = new Date(now.getTime() + days * DAY_MS)
  const grace = graceEnd(policy)
  if (grace && grace > horizon) return null
  // One extra day covers the month-end clamping described on dueCutoff.
  return new Date(addMonths(horizon, -policy.months).getTime() + DAY_MS)
}

// ── The weekly digest ───────────────────────────────────────────────────────
// Manila has no daylight saving: always UTC+8.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

/** Monday 00:00 (Asia/Manila) of the week `now` falls in, as an instant. */
export function manilaWeekStart(now: Date): Date {
  const local = new Date(now.getTime() + MANILA_OFFSET_MS)
  const daysSinceMonday = (local.getUTCDay() + 6) % 7
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday)
  return new Date(midnight - MANILA_OFFSET_MS)
}

export interface DigestWindow {
  /** The digest's week (Monday 00:00 Manila). Identifies the digest. */
  weekStart: Date
  /** Deletions announced: from this instant ... */
  from: Date
  /** ... up to (not including) this one. */
  to: Date
}

/**
 * The digest for the week `now` is in announces deletions dated from 7 to 14
 * days after that Monday. Consecutive weeks' windows touch end to end, so
 * every deletion date belongs to exactly one digest, sent at least 7 days
 * before it. A digest missed on Monday (a failed run) still goes out later
 * that week with the same window.
 */
export function digestWindow(now: Date): DigestWindow {
  const weekStart = manilaWeekStart(now)
  return {
    weekStart,
    from: new Date(weekStart.getTime() + DIGEST_LEAD_DAYS * DAY_MS),
    to: new Date(weekStart.getTime() + (DIGEST_LEAD_DAYS + DIGEST_SPAN_DAYS) * DAY_MS),
  }
}

/** Whether a record's deletion date falls in this digest's window. */
export function inDigestWindow(anchor: string | Date, policy: RetentionPolicy, w: DigestWindow): boolean {
  const d = deletionDate(anchor, policy)
  return d >= w.from && d < w.to
}

/**
 * Anchor bounds for "deletion date in [from, to)", to narrow a query (apply
 * `inDigestWindow` for the exact answer), or null when no record can be in it
 * (the safety period ends after the window).
 */
export function digestAnchorRange(
  policy: RetentionPolicy,
  w: DigestWindow,
  /** Widen each bound by this many days to cover month-end clamping. Pass 0
   *  when the bounds themselves are the answer (count-only tables), so that
   *  consecutive weeks' ranges touch exactly and nothing is counted twice. */
  slackDays = 1,
): { after: Date | null; upTo: Date } | null {
  const grace = graceEnd(policy)
  if (grace && grace >= w.to) return null
  const slack = slackDays * DAY_MS
  const upTo = new Date(addMonths(w.to, -policy.months).getTime() + slack)
  // While the safety period ends inside the window, everything older than
  // the window is held back to that date, so there's no lower bound.
  if (grace && grace >= w.from) return { after: null, upTo }
  return { after: new Date(addMonths(w.from, -policy.months).getTime() - slack), upTo }
}

// ── Anchors that need more than one column ───────────────────────────────────

/** The latest of several timestamps (nulls ignored), or null if none. */
export function latest(...dates: (string | Date | null | undefined)[]): Date | null {
  let best: Date | null = null
  for (const d of dates) {
    if (!d) continue
    const t = toDate(d)
    if (!Number.isNaN(t.getTime()) && (!best || t > best)) best = t
  }
  return best
}

export interface JobRef {
  /** null = not released yet (an active job). */
  released_at: string | null
  created_at?: string | null
}

/**
 * A customer's clock: their last activity (record created or edited, a
 * vehicle added, a job booked or released). Null while any of their jobs is
 * still active: an active customer is never deleted.
 */
export function customerAnchor(input: {
  created_at: string | null
  updated_at: string | null
  vehicle_created_at: (string | null)[]
  jobs: (JobRef & { status: string })[]
}): Date | null {
  if (input.jobs.some((j) => j.status !== "Released")) return null
  return latest(
    input.created_at,
    input.updated_at,
    ...input.vehicle_created_at,
    ...input.jobs.flatMap((j) => [j.created_at ?? null, j.released_at]),
  )
}

/**
 * An archived technician's, service's or account's clock: its archive date,
 * pushed later by any job that still uses it, so it's only deleted after the
 * last of those job records is (a job record never loses its team or
 * service). Null while not archived, or while one of those jobs is active.
 */
export function archivedAnchor(archivedAt: string | null, jobs: JobRef[]): Date | null {
  if (!archivedAt) return null
  if (jobs.some((j) => !j.released_at)) return null
  return latest(archivedAt, ...jobs.map((j) => j.released_at))
}

// ── Digest wording ──────────────────────────────────────────────────────────

const LABELS: Record<string, [string, string]> = {
  job_record: ["job record", "job records"],
  customer: ["customer", "customers"],
  inquiry: ["inquiry", "inquiries"],
  conversation: ["Messenger conversation", "Messenger conversations"],
  audit_log: ["audit trail entry", "audit trail entries"],
  user_account: ["archived account", "archived accounts"],
  technician: ["archived technician", "archived technicians"],
  service: ["archived service", "archived services"],
  notification: ["notification", "notifications"],
}

/** "1 job record", "12 inquiries": a count with the kind's own wording. */
export function countLabel(type: string, n: number): string {
  return `${n} ${(LABELS[type] ?? [type, type])[n === 1 ? 0 : 1]}`
}

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" })

/**
 * "23 records will be permanently deleted between Nov 30 and Dec 6
 * (15 job records, 8 inquiries). Export anything you need before then."
 * Null when there's nothing to announce.
 */
export function digestMessage(counts: Partial<Record<string, number>>, w: DigestWindow): string | null {
  const parts = Object.entries(counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([type, n]) => countLabel(type, n ?? 0))
  if (parts.length === 0) return null
  const total = Object.values(counts).reduce<number>((a, n) => a + (n ?? 0), 0)
  const lastDay = new Date(w.to.getTime() - DAY_MS)
  return `${total} record${total === 1 ? "" : "s"} will be permanently deleted between ${fmtDay(w.from)} and ${fmtDay(lastDay)} (${parts.join(", ")}). Export anything you need before then.`
}
