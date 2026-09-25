import { describe, it, expect } from "vitest"
import { tooltipAlign } from "@/lib/ui/calendar-tooltip"

// Regression: the calendar's hover tooltip once right-anchored the last
// columns; refactoring the cell into DayCell dropped that argument, so a
// Friday/Saturday tooltip ran off the card and was clipped.
describe("tooltipAlign", () => {
  it("left-anchors the left-hand columns (Sun–Wed)", () => {
    for (const d of [0, 1, 2, 3]) expect(tooltipAlign(d)).toBe("left")
  })

  it("right-anchors the right-hand columns so the tooltip stays inside the card (Thu–Sat)", () => {
    for (const d of [4, 5, 6]) expect(tooltipAlign(d)).toBe("right")
  })

  it("matches Date#getDay() for the reported cell, Saturday Sep 26 2026", () => {
    expect(tooltipAlign(new Date(2026, 8, 26).getDay())).toBe("right")
  })
})
