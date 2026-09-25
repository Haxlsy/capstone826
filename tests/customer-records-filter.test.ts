import { describe, it, expect } from "vitest"
import { dateAddedBounds, dateRangeError, dateRangeLabel } from "@/lib/sales/customer-records-filter"

describe("dateAddedBounds", () => {
  it("uses Manila midnight, not UTC midnight", () => {
    expect(dateAddedBounds("2026-01-06", null).gte).toBe("2026-01-05T16:00:00.000Z")
  })
  it("makes the end bound exclusive of the day AFTER the picked day", () => {
    expect(dateAddedBounds(null, "2026-01-06").lt).toBe("2026-01-06T16:00:00.000Z")
  })
  it("includes a record added 01:00 Manila on the start day", () => {
    const { gte } = dateAddedBounds("2026-01-06", null)
    expect(new Date("2026-01-05T17:00:00Z") >= new Date(gte!)).toBe(true) // 01:00 Jan 6 Manila
    expect(new Date("2026-01-05T15:59:00Z") >= new Date(gte!)).toBe(false) // 23:59 Jan 5 Manila
  })
  it("rolls month/year ends correctly", () => {
    expect(dateAddedBounds(null, "2025-12-31").lt).toBe("2025-12-31T16:00:00.000Z")
  })
  it("ignores empty or malformed values", () => {
    expect(dateAddedBounds("", "")).toEqual({})
    expect(dateAddedBounds("garbage", "2026-02-30")).toEqual({})
  })
})

describe("dateRangeError", () => {
  it("rejects start after end", () => {
    expect(dateRangeError("2026-02-01", "2026-01-01")).not.toBeNull()
  })
  it("accepts equal, open-ended and empty ranges", () => {
    expect(dateRangeError("2026-01-01", "2026-01-01")).toBeNull()
    expect(dateRangeError("2026-01-01", "")).toBeNull()
    expect(dateRangeError("", "")).toBeNull()
  })
})

describe("dateRangeLabel", () => {
  const fmt = (iso: string) => iso.slice(0, 10)
  it("describes each shape", () => {
    expect(dateRangeLabel("2026-01-01", "2026-01-31", fmt)).toBe("2026-01-01 – 2026-01-31")
    expect(dateRangeLabel("2026-01-01", "", fmt)).toBe("From 2026-01-01")
    expect(dateRangeLabel("", "2026-01-31", fmt)).toBe("Up to 2026-01-31")
    expect(dateRangeLabel("", "", fmt)).toBeNull()
  })
})
