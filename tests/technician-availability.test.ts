import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { manilaToday, isTechnicianAvailableToday } from "@/lib/technician-availability"

// Same fixed-time convention as tests/job-delay.test.ts — a comfortably
// mid-day Manila time so this suite never depends on wall-clock time.
const FIXED_NOW = "2026-01-06T06:00:00.000Z"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

describe("isTechnicianAvailableToday", () => {
  it("falls back to the weekly schedule when there is no override for today", () => {
    const { dayName } = manilaToday()
    const scheduledOff = ALL_DAYS.filter((d) => d !== dayName)
    expect(isTechnicianAvailableToday({
      is_available: false,
      available_days: scheduledOff,
      availability_override_date: null,
    })).toBe(false)

    expect(isTechnicianAvailableToday({
      is_available: false, // sticky column value is irrelevant without a matching override
      available_days: ALL_DAYS,
      availability_override_date: null,
    })).toBe(true)
  })

  it("lets today's override make an off-day technician available (the reported scenario)", () => {
    const { dateKey, dayName } = manilaToday()
    const scheduledOff = ALL_DAYS.filter((d) => d !== dayName)
    expect(isTechnicianAvailableToday({
      is_available: true,
      available_days: scheduledOff,
      availability_override_date: dateKey,
    })).toBe(true)
  })

  it("lets today's override mark a scheduled-to-work technician unavailable", () => {
    const { dateKey, dayName } = manilaToday()
    expect(isTechnicianAvailableToday({
      is_available: false,
      available_days: [dayName],
      availability_override_date: dateKey,
    })).toBe(false)
  })

  it("ignores a stale override from a different date", () => {
    const { dayName } = manilaToday()
    const scheduledOff = ALL_DAYS.filter((d) => d !== dayName)
    expect(isTechnicianAvailableToday({
      is_available: true, // stale override, from some earlier day — must not win
      available_days: scheduledOff,
      availability_override_date: "2000-01-01",
    })).toBe(false)
  })
})
