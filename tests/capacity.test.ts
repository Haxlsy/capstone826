import { describe, it, expect } from "vitest"
import { capacityStatus } from "@/lib/admin/capacity"

describe("capacityStatus", () => {
  it("is empty and ok with no jobs", () => {
    expect(capacityStatus(0, 15)).toEqual({ pct: 0, tone: "ok", over: 0 })
  })

  it("keeps the 70% / 90% colour bands", () => {
    expect(capacityStatus(10, 20).tone).toBe("ok")
    expect(capacityStatus(14, 20).tone).toBe("busy")
    expect(capacityStatus(18, 20).tone).toBe("full")
  })

  it("is full at exactly capacity, with nothing over", () => {
    expect(capacityStatus(15, 15)).toEqual({ pct: 100, tone: "full", over: 0 })
  })

  it("caps the bar at 100% and reports how many over", () => {
    expect(capacityStatus(18, 15)).toEqual({ pct: 100, tone: "full", over: 3 })
  })

  it("guards a missing or zero capacity", () => {
    expect(capacityStatus(2, 0)).toMatchObject({ pct: 100, over: 1 })
  })
})
