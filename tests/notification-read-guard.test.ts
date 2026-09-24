import { describe, it, expect } from "vitest"
import { shouldMarkRead } from "@/hooks/useNotifications"

// Defect: clicking an already-read notification still called markOne(), which
// unconditionally decremented unreadCount by one it was never carrying — the
// badge dropped (5 -> 4), then the next real fetch corrected it back up
// (4 -> 5), a visible flicker for a row that was never unread.
describe("shouldMarkRead", () => {
  it("returns false for an already-read notification (the regression)", () => {
    expect(shouldMarkRead({ is_read: true })).toBe(false)
  })

  it("returns true for an unread notification", () => {
    expect(shouldMarkRead({ is_read: false })).toBe(true)
  })

  it("returns false when the notification can't be found", () => {
    expect(shouldMarkRead(undefined)).toBe(false)
  })
})
