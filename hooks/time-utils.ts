const WORK_START = 8 * 60  // 8 AM in minutes (Asia/Manila)
const WORK_END   = 20 * 60 // 8 PM in minutes (Asia/Manila)

// The Philippines has a fixed UTC+8 offset (no daylight saving time).
// Shifting by +8h lets us read the Manila wall clock through the UTC getters,
// so the working-hours math is identical regardless of the server's timezone.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export function addWorkingMins(from: Date, mins: number): Date {
  const manila   = new Date(from.getTime() + MANILA_OFFSET_MS)
  let remaining = mins
  while (remaining > 0) {
    const nowMins    = manila.getUTCHours() * 60 + manila.getUTCMinutes()
    const availToday = WORK_END - nowMins
    if (availToday <= 0) {
      manila.setUTCDate(manila.getUTCDate() + 1)
      manila.setUTCHours(WORK_START / 60, 0, 0, 0)
      continue
    }
    if (remaining <= availToday) {
      manila.setTime(manila.getTime() + remaining * 60_000)
      remaining = 0
    } else {
      remaining -= availToday
      manila.setUTCDate(manila.getUTCDate() + 1)
      manila.setUTCHours(WORK_START / 60, 0, 0, 0)
    }
  }
  return new Date(manila.getTime() - MANILA_OFFSET_MS)
}
