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

export interface TechnicianAvailabilityInput {
  is_available: boolean
  available_days: string[]
  availability_override_date: string | null
}

/** THE single source of truth for "is this technician available right now." */
export function isTechnicianAvailableToday(t: TechnicianAvailabilityInput): boolean {
  const { dateKey, dayName } = manilaToday()
  if (t.availability_override_date === dateKey) return t.is_available
  return t.available_days.includes(dayName)
}
