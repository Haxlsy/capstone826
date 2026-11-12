import { describe, it, expect } from "vitest"
import { tooltipAlign, placeCalendarTooltip } from "@/lib/ui/calendar-tooltip"

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

describe("placeCalendarTooltip", () => {
  const panel = { width: 208, height: 200 }
  const viewport = { width: 1280, height: 800 }
  const cell = (top: number, left: number) => ({ top, bottom: top + 80, left, right: left + 90 })

  it("opens below a day when there's room", () => {
    expect(placeCalendarTooltip(cell(100, 300), panel, viewport, "left")).toEqual({ top: 186, left: 300 })
  })

  it("flips above a day in the last rows instead of running off the bottom", () => {
    const pos = placeCalendarTooltip(cell(680, 300), panel, viewport, "left")
    expect(pos.top).toBe(680 - 6 - 200)
    expect(pos.top + panel.height).toBeLessThanOrEqual(680)
  })

  it("lines up the right edges for the right-hand columns", () => {
    expect(placeCalendarTooltip(cell(100, 900), panel, viewport, "right").left).toBe(900 + 90 - 208)
  })

  it("stays inside a narrow window", () => {
    const narrow = { width: 400, height: 800 }
    expect(placeCalendarTooltip(cell(100, 350), panel, narrow, "left").left).toBe(400 - 208 - 8)
    expect(placeCalendarTooltip(cell(100, 0), panel, narrow, "right").left).toBe(8)
  })
})
