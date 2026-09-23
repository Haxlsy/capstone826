import { describe, it, expect } from "vitest"
import { isWithinRecordDateRange } from "@/lib/operations/job-records-filter"

describe("isWithinRecordDateRange", () => {
  const record = { scheduled_at: "2026-06-10T09:00:00.000Z", released_at: "2026-06-12T15:00:00.000Z" }

  it("matches when both dates fall inside the picked range", () => {
    expect(isWithinRecordDateRange(record, "2026-06-01", "2026-06-30")).toBe(true)
  })

  it("excludes a record scheduled before the picked start date", () => {
    expect(isWithinRecordDateRange(record, "2026-06-11", "")).toBe(false)
  })

  it("excludes a record released after the picked end date", () => {
    expect(isWithinRecordDateRange(record, "", "2026-06-11")).toBe(false)
  })

  it("includes a record released on the picked end date itself (inclusive end bound)", () => {
    // Previously excluded — new Date("2026-06-12") parsed to that day's
    // midnight, so anything released later the same day fell outside.
    const sameDayRelease = { scheduled_at: record.scheduled_at, released_at: "2026-06-12T23:00:00.000Z" }
    expect(isWithinRecordDateRange(sameDayRelease, "", "2026-06-12")).toBe(true)
  })

  it("no filters set matches everything", () => {
    expect(isWithinRecordDateRange(record, "", "")).toBe(true)
  })

  it("a record with no scheduled_at is excluded once a start date is picked", () => {
    expect(isWithinRecordDateRange({ scheduled_at: null, released_at: record.released_at }, "2026-06-01", "")).toBe(false)
  })

  it("a record with no released_at is excluded once an end date is picked", () => {
    expect(isWithinRecordDateRange({ scheduled_at: record.scheduled_at, released_at: null }, "", "2026-06-30")).toBe(false)
  })
})
