/**
 * "Date added" filter for Customer Records. Bounds are whole Asia/Manila days
 * (the shop's timezone, and the one the list displays dates in) so a record
 * shown as "Jan 6" is included by a Jan 6 filter. Job Order Records compares
 * in UTC; that would drop anything added before 08:00 Manila on the start day.
 * The Philippines has no DST, so a fixed +08:00 offset is exact.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/

function isRealDay(day: string): boolean {
  if (!DAY.test(day)) return false
  const d = new Date(`${day}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(day)
}

/** ISO instants for created_at: `gte` the start of `from`, `lt` the start of the day after `to`. */
export function dateAddedBounds(
  from?: string | null,
  to?: string | null,
): { gte?: string; lt?: string } {
  const out: { gte?: string; lt?: string } = {}
  if (from && isRealDay(from)) out.gte = new Date(`${from}T00:00:00+08:00`).toISOString()
  if (to && isRealDay(to)) {
    const next = new Date(`${to}T00:00:00+08:00`)
    next.setUTCDate(next.getUTCDate() + 1)
    out.lt = next.toISOString()
  }
  return out
}

/** Validation message for the picked range, or null when it's usable. */
export function dateRangeError(from: string, to: string): string | null {
  if (from && to && from > to) return "Start date must be on or before the end date."
  return null
}

/** "Jan 5, 2026 – Jan 9, 2026", "From …", "Up to …", or null when no range is set. */
export function dateRangeLabel(
  from: string,
  to: string,
  fmt: (iso: string) => string,
): string | null {
  const f = from ? fmt(`${from}T00:00:00+08:00`) : null
  const t = to ? fmt(`${to}T00:00:00+08:00`) : null
  if (f && t) return `${f} – ${t}`
  if (f) return `From ${f}`
  if (t) return `Up to ${t}`
  return null
}
