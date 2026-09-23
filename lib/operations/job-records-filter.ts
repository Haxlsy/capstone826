/**
 * Job Order Records' Start/End Date filter — previously compared against
 * `created_at` (when the row was made in the system), which isn't what
 * "Start Date"/"End Date" mean on a page about scheduled, completed work.
 * A record is included when its scheduled start is on/after the picked
 * start date AND its release date is on/before the picked end date.
 *
 * `startDate`/`endDate` are bare "YYYY-MM-DD" strings from a date input.
 * The end bound is inclusive of the whole picked day (a naive
 * `new Date(endDate)` parses to that day's midnight, which would wrongly
 * exclude anything released later that same day).
 */
export function isWithinRecordDateRange(
  record: { scheduled_at: string | null; released_at: string | null },
  startDate: string,
  endDate: string,
): boolean {
  // Explicit "Z" (UTC) boundaries throughout — a date-time string without one
  // parses as LOCAL time (a well-known `Date` quirk), which would make the
  // range silently shift with whatever timezone this happens to run in (dev
  // machine, CI, the deployed server). Matches this app's existing
  // convention for date-input handling elsewhere (e.g. AddJobOrderForm's
  // `todayStr`, also UTC-based).
  if (startDate) {
    if (!record.scheduled_at) return false
    if (new Date(record.scheduled_at) < new Date(`${startDate}T00:00:00.000Z`)) return false
  }
  if (endDate) {
    if (!record.released_at) return false
    // Inclusive of the whole picked end day: compare against the START of
    // the NEXT day instead of a "23:59:59.999" same-day literal, which is
    // the same kind of off-by-a-bit trap as the local-time one above.
    const nextDay = new Date(`${endDate}T00:00:00.000Z`)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    if (new Date(record.released_at) >= nextDay) return false
  }
  return true
}
