import { describe, it, expect } from "vitest"
import {
  newInquiryIds,
  resolveSelectedId,
  newInquiryToast,
} from "@/lib/sales/inquiry-list"

// The two rules that make a realtime refresh safe to run under someone who is
// mid-reply: announce only genuinely new escalations, and never move their
// selection.

describe("newInquiryIds", () => {
  it("returns only ids that were not already on screen", () => {
    expect(newInquiryIds(["a", "b"], ["c", "a", "b"])).toEqual(["c"])
  })

  it("returns nothing when a refresh only changed existing rows", () => {
    // A colleague resolving an inquiry must not toast as if it were new.
    expect(newInquiryIds(["a", "b"], ["a", "b"])).toEqual([])
  })

  it("treats the very first load as all-new", () => {
    expect(newInquiryIds([], ["a", "b"])).toEqual(["a", "b"])
  })

  it("ignores rows that disappeared", () => {
    expect(newInquiryIds(["a", "b"], ["a"])).toEqual([])
  })

  it("preserves the incoming order", () => {
    expect(newInquiryIds(["b"], ["c", "b", "a"])).toEqual(["c", "a"])
  })
})

describe("resolveSelectedId", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }]

  it("keeps the current selection when it still exists", () => {
    // The core guarantee: a new escalation must not yank Sales off the inquiry
    // they are reading.
    expect(resolveSelectedId("b", list)).toBe("b")
  })

  it("selects the first row when nothing is selected yet", () => {
    expect(resolveSelectedId(null, list)).toBe("a")
  })

  it("falls back to the first row when the selection disappeared", () => {
    expect(resolveSelectedId("zzz", list)).toBe("a")
  })

  it("returns null for an empty list", () => {
    expect(resolveSelectedId("a", [])).toBeNull()
    expect(resolveSelectedId(null, [])).toBeNull()
  })
})

describe("newInquiryToast", () => {
  it("names the customer and type for a single escalation", () => {
    const msg = newInquiryToast([{ messengerName: "Caleb Dela Cruz", type: "Booking" }])
    expect(msg).toContain("Caleb Dela Cruz")
    expect(msg).toContain("Booking")
  })

  it("collapses a burst into a count", () => {
    const msg = newInquiryToast([
      { messengerName: "A", type: "Booking" },
      { messengerName: "B", type: "Report" },
    ])
    expect(msg).toBe("2 new escalations")
  })
})

describe("resolveSelectedId with a pending request", () => {
  const list = [{ id: "a" }, { id: "b" }]
  it("selects the requested inquiry once it is in the list", () => {
    expect(resolveSelectedId("a", list, "b")).toBe("b")
  })
  it("keeps waiting (does not snap to the first row) while it is not in the list", () => {
    expect(resolveSelectedId("zzz", list, "zzz")).toBe("zzz")
  })
  it("falls back normally without a pending request", () => {
    expect(resolveSelectedId("zzz", list)).toBe("a")
  })
})
