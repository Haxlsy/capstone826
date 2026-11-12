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

export interface Box {
  top: number
  bottom: number
  left: number
  right: number
}

/** Gap between the day cell and its hover card, and the minimum distance kept from the window edge. */
const GAP = 6
const EDGE = 8

/**
 * Where to put a day's hover card on screen (`position: fixed` coordinates).
 * The card is rendered on document.body, outside the calendar card, so it is
 * never cut off by the calendar's overflow-hidden edge. It opens below the day
 * when it fits, else above it when there's more room there (the month's last
 * rows), and is kept inside the window horizontally.
 */
export function placeCalendarTooltip(
  cell: Box,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  align: "left" | "right",
): { top: number; left: number } {
  const spaceBelow = viewport.height - cell.bottom
  const spaceAbove = cell.top
  const openAbove = spaceBelow < panel.height + GAP + EDGE && spaceAbove > spaceBelow
  const top = openAbove ? cell.top - GAP - panel.height : cell.bottom + GAP

  const preferred = align === "right" ? cell.right - panel.width : cell.left
  const maxLeft = Math.max(EDGE, viewport.width - panel.width - EDGE)
  const left = Math.max(EDGE, Math.min(preferred, maxLeft))

  return { top: Math.max(EDGE, top), left }
}
