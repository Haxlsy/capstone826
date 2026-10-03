import { describe, it, expect } from "vitest"
import { addWorkingMins, DEFAULT_SCHEDULE, type WorkSchedule } from "@/hooks/time-utils"

// Manila is UTC+8, no DST — a UTC ISO string's hour + 8 is the Manila wall
// clock hour. 2026-01-07 is a Wednesday.
const WED_5PM_MANILA = "2026-01-07T09:00:00.000Z" // 5:00 PM Manila
const WED_2PM_MANILA = "2026-01-07T06:00:00.000Z" // 2:00 PM Manila
const THU_9AM_MANILA = "2026-01-08T01:00:00.000Z" // 9:00 AM Manila (closed day, mid-slot)

function manilaWallClock(iso: string): { day: number; hh: number; mm: number } {
  const d = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)
  return { day: d.getUTCDay(), hh: d.getUTCHours(), mm: d.getUTCMinutes() }
}

describe("addWorkingMins — default schedule (every day, 8 AM-8 PM)", () => {
  it("reproduces the previously-hardcoded same-day behavior", () => {
    const result = addWorkingMins(new Date(WED_2PM_MANILA), 120) // 2 PM + 2h = 4 PM, same day
    const w = manilaWallClock(result.toISOString())
    expect(w.day).toBe(3) // still Wednesday
    expect(w.hh).toBe(16)
  })

  it("rolls into tomorrow's opening time when the day runs out", () => {
    const result = addWorkingMins(new Date(WED_5PM_MANILA), 6 * 60) // 3h left today, 3h into Thursday
    const w = manilaWallClock(result.toISOString())
    expect(w.day).toBe(4) // Thursday
    expect(w.hh).toBe(11) // 8 AM + 3h
  })
})

describe("addWorkingMins — custom schedule", () => {
  const wedFriOnly: WorkSchedule = {
    openDays: new Set([3, 5]), // Wed, Fri only
    openMinutes: 8 * 60,
    closeMinutes: 20 * 60,
  }

  it("skips a single closed day (your scenario: Wed 5 PM + 6h, Thu closed -> Fri opening)", () => {
    const schedule: WorkSchedule = { openDays: new Set([3, 5]), openMinutes: 8 * 60, closeMinutes: 20 * 60 } // Wed, Fri (Thu closed)
    const result = addWorkingMins(new Date(WED_5PM_MANILA), 6 * 60, schedule)
    const w = manilaWallClock(result.toISOString())
    expect(w.day).toBe(5) // Friday
    expect(w.hh).toBe(11) // 3h remaining from Friday's 8 AM opening
  })

  it("skips several consecutive closed days in one call", () => {
    // Only Wed and the FOLLOWING Wed open (a whole week closed in between).
    const schedule: WorkSchedule = { openDays: new Set([3]), openMinutes: 8 * 60, closeMinutes: 20 * 60 }
    const result = addWorkingMins(new Date(WED_5PM_MANILA), 6 * 60, schedule)
    const w = manilaWallClock(result.toISOString())
    expect(w.day).toBe(3) // landed on a Wednesday
    expect(w.hh).toBe(11)
    // Exactly 7 days later than the same-schedule single-skip case's Wednesday.
    expect(new Date(result).getUTCDate()).toBe(14)
  })

  it("starting ON a closed day rolls forward to the next open one", () => {
    const result = addWorkingMins(new Date(THU_9AM_MANILA), 60, wedFriOnly) // Thu is closed
    const w = manilaWallClock(result.toISOString())
    expect(w.day).toBe(5) // Friday
    expect(w.hh).toBe(9) // 8 AM opening + 1h
  })

  it("starting before opening on an open day snaps to that day's opening time", () => {
    const earlyWed = "2026-01-06T22:00:00.000Z" // 6:00 AM Manila Wednesday
    const result = addWorkingMins(new Date(earlyWed), 30, wedFriOnly)
    const w = manilaWallClock(result.toISOString())
    expect(w.day).toBe(3)
    expect(w.hh).toBe(8)
    expect(w.mm).toBe(30)
  })

  it("a schedule with only one open day in the week still terminates and lands on it", () => {
    const schedule: WorkSchedule = { openDays: new Set([0]), openMinutes: 8 * 60, closeMinutes: 20 * 60 } // Sunday only
    const result = addWorkingMins(new Date(WED_5PM_MANILA), 30, schedule)
    const w = manilaWallClock(result.toISOString())
    expect(w.day).toBe(0)
    expect(w.hh).toBe(8)
  })

  it("DEFAULT_SCHEDULE is exported and has every day open, 8 AM-8 PM", () => {
    expect(DEFAULT_SCHEDULE.openDays.size).toBe(7)
    expect(DEFAULT_SCHEDULE.openMinutes).toBe(8 * 60)
    expect(DEFAULT_SCHEDULE.closeMinutes).toBe(20 * 60)
  })

  it("skips a holiday exactly like a closed weekday, even though its weekday is otherwise open", () => {
    // Every day open, but Thursday Jan 8 2026 is a one-off holiday.
    const schedule: WorkSchedule = {
      openDays: new Set([0, 1, 2, 3, 4, 5, 6]),
      openMinutes: 8 * 60,
      closeMinutes: 20 * 60,
      holidayDates: new Set(["2026-01-08"]),
    }
    const result = addWorkingMins(new Date(WED_5PM_MANILA), 6 * 60, schedule) // 3h left Wed, 3h into Thu (holiday)
    const w = manilaWallClock(result.toISOString())
    expect(w.day).toBe(5) // rolled past the holiday straight to Friday
    expect(w.hh).toBe(11) // 3h remaining from Friday's 8 AM opening
  })

  it("a WorkSchedule with no holidayDates behaves exactly as before (optional field)", () => {
    const schedule: WorkSchedule = { openDays: new Set([0, 1, 2, 3, 4, 5, 6]), openMinutes: 8 * 60, closeMinutes: 20 * 60 }
    const result = addWorkingMins(new Date(WED_2PM_MANILA), 120, schedule)
    const w = manilaWallClock(result.toISOString())
    expect(w.day).toBe(3)
    expect(w.hh).toBe(16)
  })
})
