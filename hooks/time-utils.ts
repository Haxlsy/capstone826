export interface WorkSchedule {
  /** Open days, Date#getUTCDay() convention: 0=Sun .. 6=Sat. */
  openDays: Set<number>
  /** Minutes since midnight, e.g. 480 for 8:00 AM. */
  openMinutes: number
  /** Minutes since midnight, e.g. 1200 for 8:00 PM. */
  closeMinutes: number
  /** Specific closed calendar dates (Manila-local "YYYY-MM-DD"), on top of the
   *  weekly openDays — e.g. a one-off holiday. Optional so existing callers
   *  that build a WorkSchedule literal without one still compile. */
  holidayDates?: Set<string>
}

/** Today's hours, every day — the schedule every caller used before this was
 *  configurable, and what a caller that doesn't pass one still gets. */
export const DEFAULT_SCHEDULE: WorkSchedule = {
  openDays: new Set([0, 1, 2, 3, 4, 5, 6]),
  openMinutes: 8 * 60,
  closeMinutes: 20 * 60,
}

// The Philippines has a fixed UTC+8 offset (no daylight saving time).
// Shifting by +8h lets us read the Manila wall clock through the UTC getters,
// so the working-hours math is identical regardless of the server's timezone.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

/** `d`'s Manila-local calendar date as "YYYY-MM-DD" — `d` is expected to
 *  already be the Manila-shifted Date every caller here passes around, so its
 *  UTC getters read as the Manila wall-clock date. */
function manilaDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

function isOpenDay(d: Date, schedule: WorkSchedule): boolean {
  if (schedule.holidayDates?.has(manilaDateKey(d))) return false
  return schedule.openDays.has(d.getUTCDay())
}

/** Moves `d` forward to the next open day's opening time — always advances
 *  at least one day, and keeps advancing over any number of consecutive
 *  closed days until it lands on one that's open. */
function jumpToNextOpenDay(d: Date, schedule: WorkSchedule): void {
  do {
    d.setUTCDate(d.getUTCDate() + 1)
  } while (!isOpenDay(d, schedule))
  d.setUTCHours(Math.floor(schedule.openMinutes / 60), schedule.openMinutes % 60, 0, 0)
}

/**
 * Adds `mins` of working time to `from`, honoring `schedule`'s open days and
 * hours — skipping any closed day entirely (including several in a row) and
 * continuing on the next open day's opening time. Defaults to every day,
 * 8 AM-8 PM (today's previously-hardcoded hours) when no schedule is given.
 */
export function addWorkingMins(from: Date, mins: number, schedule: WorkSchedule = DEFAULT_SCHEDULE): Date {
  const manila = new Date(from.getTime() + MANILA_OFFSET_MS)

  // Clamp the start onto a valid open slot before consuming any minutes:
  // before opening rounds up to opening the same day; a closed day, or past
  // closing, rolls to the next open day's opening time.
  if (!isOpenDay(manila, schedule)) {
    jumpToNextOpenDay(manila, schedule)
  } else {
    const nowMins = manila.getUTCHours() * 60 + manila.getUTCMinutes()
    if (nowMins < schedule.openMinutes) {
      manila.setUTCHours(Math.floor(schedule.openMinutes / 60), schedule.openMinutes % 60, 0, 0)
    } else if (nowMins >= schedule.closeMinutes) {
      jumpToNextOpenDay(manila, schedule)
    }
  }

  let remaining = mins
  while (remaining > 0) {
    const nowMins = manila.getUTCHours() * 60 + manila.getUTCMinutes()
    const availToday = schedule.closeMinutes - nowMins
    if (remaining <= availToday) {
      manila.setTime(manila.getTime() + remaining * 60_000)
      remaining = 0
    } else {
      remaining -= availToday
      jumpToNextOpenDay(manila, schedule)
    }
  }
  return new Date(manila.getTime() - MANILA_OFFSET_MS)
}
