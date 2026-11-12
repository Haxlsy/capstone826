/**
 * The single source of truth for "is this technician available right now" —
 * every surface that shows or edits a technician's availability (Admin
 * Dashboard, Operations' Technician Availability roster, Add Job Order's crew
 * picker, Job Order Detail's substitute picker) computes it via this module
 * instead of reading the raw `is_available` column directly.
 *
 * `available_days` (the recurring weekly schedule) and `is_available` (a
 * manual toggle) used to be two fully disconnected columns — flipping the
 * toggle wrote `is_available` with no relationship to the schedule at all, so
 * it could silently drift out of sync for days or weeks until someone
 * happened to flip it back. `availability_override_date` scopes the toggle to
 * a single calendar day: it's authoritative only when it matches today, and
 * on every other day availability falls back to the weekly schedule — so an
 * exception (a technician working their normal day off, with Ops' approval)
 * never needs to be manually un-done.
 */

// The Philippines has a fixed UTC+8 offset (no daylight saving time) — same
// technique as hooks/time-utils.ts, so "today" means the same calendar day
// everywhere in this codebase regardless of the server's own timezone.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function manilaToday(): { dateKey: string; dayName: string } {
  const manila = new Date(Date.now() + MANILA_OFFSET_MS)
  return {
    dateKey: manila.toISOString().slice(0, 10), // e.g. "2026-09-17"
    dayName: DAY_NAMES[manila.getUTCDay()],
  }
}

/**
 * 23:59:59.999 of the Manila calendar day `now` falls on, as an absolute
 * instant (a UTC Date). Used by the Admin dashboard's "Active Jobs Today"
 * (jobs scheduled up to the end of today).
 */
export function endOfManilaDay(now: Date = new Date()): Date {
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS)
  const endUtcClock = Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate(), 23, 59, 59, 999)
  return new Date(endUtcClock - MANILA_OFFSET_MS)
}

export interface TechnicianAvailabilityInput {
  is_available: boolean
  available_days: string[]
  availability_override_date: string | null
}

/** The Manila calendar day an instant falls on, e.g. { dateKey: "2026-11-17", dayName: "Tue" }. */
export function manilaDayOf(at: Date | string): { dateKey: string; dayName: string } {
  const manila = new Date(new Date(at).getTime() + MANILA_OFFSET_MS)
  return {
    dateKey: manila.toISOString().slice(0, 10),
    dayName: DAY_NAMES[manila.getUTCDay()],
  }
}

/**
 * Whether someone is available on a given Manila day. The manual toggle only
 * counts on the day it was set (availability_override_date); any other day
 * follows the weekly schedule. Used for crew AND head technicians, so the two
 * can never be judged by different rules.
 */
export function isAvailableOn(
  t: TechnicianAvailabilityInput,
  day: { dateKey: string; dayName: string },
): boolean {
  if (t.availability_override_date === day.dateKey) return t.is_available
  return (t.available_days ?? []).includes(day.dayName)
}

/** THE single source of truth for "is this technician available right now." */
export function isTechnicianAvailableToday(t: TechnicianAvailabilityInput): boolean {
  return isAvailableOn(t, manilaToday())
}
