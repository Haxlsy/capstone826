/**
 * Which edge a calendar day's hover tooltip anchors to. The tooltip (w-52,
 * about 2.4 day-cells wide) is wider than a cell, so anchoring it to the left
 * edge in the right-hand columns pushes it past the card's overflow-hidden
 * edge and clips it ("Click for f…"). Right-anchor those columns instead.
 *
 * `dayOfWeek` is Date#getDay() (0 = Sunday .. 6 = Saturday), which is also the
 * column index in both the month and week views (weeks start on Sunday).
 * Thursday onward, not just Fri/Sat, so a narrower card doesn't clip it.
 */
export function tooltipAlign(dayOfWeek: number): "left" | "right" {
  return dayOfWeek >= 4 ? "right" : "left"
}
