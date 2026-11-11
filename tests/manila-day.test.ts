import { describe, it, expect } from "vitest"
import { endOfManilaDay } from "@/lib/technician-availability"

describe("endOfManilaDay", () => {
  it("ends at 23:59:59.999 Manila time (15:59:59.999 UTC)", () => {
    // 10:00 Manila on Nov 7 = 02:00 UTC
    expect(endOfManilaDay(new Date("2026-11-07T02:00:00Z")).toISOString()).toBe("2026-11-07T15:59:59.999Z")
  })

  it("uses the Manila date when it differs from the UTC date", () => {
    // 20:00 UTC Nov 6 = 04:00 Manila Nov 7, still Nov 7 in Manila
    expect(endOfManilaDay(new Date("2026-11-06T20:00:00Z")).toISOString()).toBe("2026-11-07T15:59:59.999Z")
    // 23:30 Manila Nov 7 = 15:30 UTC, same day
    expect(endOfManilaDay(new Date("2026-11-07T15:30:00Z")).toISOString()).toBe("2026-11-07T15:59:59.999Z")
    // 00:30 Manila Nov 8 = 16:30 UTC Nov 7, next day
    expect(endOfManilaDay(new Date("2026-11-07T16:30:00Z")).toISOString()).toBe("2026-11-08T15:59:59.999Z")
  })
})
