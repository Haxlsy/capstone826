import { describe, it, expect } from "vitest"
import {
  headCoverage, jobWorkingDay, headWarningText, headPickerNote, type HeadOnJob,
} from "@/lib/operations/head-coverage"
import { isAvailableOn } from "@/lib/technician-availability"

// Thu, Nov 12 2026, 10:00 Manila (02:00 UTC).
const NOW = new Date("2026-11-12T02:00:00Z")
const TODAY = "2026-11-12"
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function head(over: Partial<HeadOnJob> = {}): HeadOnJob {
  return {
    id: "h1", full_name: "Juan Dela Cruz", role: "head_detailer", is_archived: false,
    role_in_job: "head_detailer", is_available: true, available_days: ALL_DAYS,
    availability_override_date: null, ...over,
  }
}
const ongoing = { status: "Ongoing", scheduled_at: "2026-11-12T01:00:00Z" }

describe("isAvailableOn", () => {
  it("uses the toggle only on its own day, else the weekly schedule", () => {
    const t = { is_available: false, available_days: ALL_DAYS, availability_override_date: TODAY }
    expect(isAvailableOn(t, { dateKey: TODAY, dayName: "Thu" })).toBe(false)
    expect(isAvailableOn(t, { dateKey: "2026-11-13", dayName: "Fri" })).toBe(true)
    expect(isAvailableOn({ ...t, availability_override_date: null, available_days: ["Mon"] }, { dateKey: TODAY, dayName: "Thu" })).toBe(false)
  })
})

describe("jobWorkingDay", () => {
  it("is today for today's, carried-over and undated jobs", () => {
    expect(jobWorkingDay("2026-11-12T01:00:00Z", NOW)).toMatchObject({ dateKey: TODAY, isToday: true })
    expect(jobWorkingDay("2026-11-09T01:00:00Z", NOW)).toMatchObject({ dateKey: TODAY, isToday: true })
    expect(jobWorkingDay(null, NOW)).toMatchObject({ dateKey: TODAY, isToday: true })
  })
  it("is the scheduled day for a future job (Manila date, not UTC)", () => {
    // 17:00 UTC Nov 16 = 01:00 Manila Tue Nov 17
    expect(jobWorkingDay("2026-11-16T17:00:00Z", NOW)).toMatchObject({ dateKey: "2026-11-17", dayName: "Tue", isToday: false })
  })
})

describe("headCoverage", () => {
  it("no warning when the head is available", () => {
    expect(headCoverage(ongoing, [head()], NOW)).toEqual([])
  })

  it("warns when the head is toggled off today", () => {
    const w = headCoverage(ongoing, [head({ is_available: false, availability_override_date: TODAY })], NOW)
    expect(w).toHaveLength(1)
    expect(w[0]).toMatchObject({ role: "head_detailer", heads: [{ reason: "off_today" }] })
  })

  it("a toggle from yesterday no longer counts (resets at midnight)", () => {
    expect(headCoverage(ongoing, [head({ is_available: false, availability_override_date: "2026-11-11" })], NOW)).toEqual([])
  })

  it("an available substitute covers the role", () => {
    const off = head({ is_available: false, availability_override_date: TODAY })
    expect(headCoverage(ongoing, [off, head({ id: "h2", full_name: "Sub" })], NOW)).toEqual([])
  })

  it("a substitute who is also unavailable still warns, listing both", () => {
    const off = head({ is_available: false, availability_override_date: TODAY })
    const subOff = head({ id: "h2", full_name: "Sub", available_days: ["Mon"] })
    const w = headCoverage(ongoing, [off, subOff], NOW)
    expect(w[0].heads.map((h) => h.reason)).toEqual(["off_today", "not_scheduled"])
  })

  it("both roles uncovered gives two warnings", () => {
    const d = head({ is_available: false, availability_override_date: TODAY })
    const i = head({ id: "i1", role: "head_installer", role_in_job: "head_installer", available_days: ["Mon"] })
    expect(headCoverage(ongoing, [d, i], NOW).map((w) => w.role)).toEqual(["head_detailer", "head_installer"])
  })

  it("a role with no head assigned is not needed, so never warns", () => {
    expect(headCoverage(ongoing, [], NOW)).toEqual([])
  })

  it("an advance job warns when booked on the head's non-working weekday", () => {
    const tueJob = { status: "Pending", scheduled_at: "2026-11-16T17:00:00Z" }
    const w = headCoverage(tueJob, [head({ available_days: ["Mon", "Wed"] })], NOW)
    expect(w[0]).toMatchObject({ day: { dayName: "Tue", isToday: false }, heads: [{ reason: "not_scheduled" }] })
  })

  it("today's toggle doesn't affect a job scheduled on a later day", () => {
    const later = { status: "Pending", scheduled_at: "2026-11-16T17:00:00Z" }
    expect(headCoverage(later, [head({ is_available: false, availability_override_date: TODAY })], NOW)).toEqual([])
  })

  it("an archived head, or one whose role changed, can't cover", () => {
    expect(headCoverage(ongoing, [head({ is_archived: true })], NOW)[0].heads[0].reason).toBe("archived")
    expect(headCoverage(ongoing, [head({ role: "operations" })], NOW)[0].heads[0].reason).toBe("not_head")
  })

  it("only Pending, Ongoing and For Rework jobs warn", () => {
    const off = head({ is_available: false, availability_override_date: TODAY })
    for (const status of ["For Inspection", "For Release", "Released", "Cancelled"]) {
      expect(headCoverage({ ...ongoing, status }, [off], NOW)).toEqual([])
    }
    for (const status of ["Pending", "Ongoing", "For Rework"]) {
      expect(headCoverage({ ...ongoing, status }, [off], NOW)).toHaveLength(1)
    }
  })
})

describe("headWarningText", () => {
  it("reads plainly for today and for a future day", () => {
    const today = headCoverage(ongoing, [head({ is_available: false, availability_override_date: TODAY })], NOW)[0]
    expect(headWarningText(today)).toBe(
      "Head Detailer Juan Dela Cruz isn't available today. Assign a substitute head detailer for this job.",
    )
    const future = headCoverage({ status: "Pending", scheduled_at: "2026-11-16T17:00:00Z" }, [head({ available_days: ["Mon"] })], NOW)[0]
    expect(headWarningText(future)).toContain("isn't available on Tue, Nov 17")
  })

  it("says when the head is no longer an active head technician", () => {
    const w = headCoverage(ongoing, [head({ is_archived: true })], NOW)[0]
    expect(headWarningText(w)).toContain("is no longer an active head technician")
  })
})

describe("headPickerNote", () => {
  it("labels unavailable heads for the job's day", () => {
    const off = { is_available: false, available_days: ALL_DAYS, availability_override_date: TODAY }
    expect(headPickerNote(off, { dateKey: TODAY, dayName: "Thu", isToday: true })).toBe("Unavailable today")
    expect(headPickerNote({ ...off, availability_override_date: null, available_days: ["Mon"] }, { dateKey: "2026-11-17", dayName: "Tue", isToday: false }))
      .toBe("Not scheduled on Tue, Nov 17")
    expect(headPickerNote({ ...off, availability_override_date: null }, { dateKey: TODAY, dayName: "Thu", isToday: true })).toBeNull()
  })
})
