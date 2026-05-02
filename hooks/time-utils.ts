const WORK_START = 8 * 60  // 8 AM in minutes
const WORK_END   = 20 * 60 // 8 PM in minutes

export function addWorkingMins(from: Date, mins: number): Date {
  let current   = new Date(from)
  let remaining = mins
  while (remaining > 0) {
    const nowMins    = current.getHours() * 60 + current.getMinutes()
    const availToday = WORK_END - nowMins
    if (availToday <= 0) {
      current.setDate(current.getDate() + 1)
      current.setHours(WORK_START / 60, 0, 0, 0)
      continue
    }
    if (remaining <= availToday) {
      current = new Date(current.getTime() + remaining * 60_000)
      remaining = 0
    } else {
      remaining -= availToday
      current.setDate(current.getDate() + 1)
      current.setHours(WORK_START / 60, 0, 0, 0)
    }
  }
  return current
}
