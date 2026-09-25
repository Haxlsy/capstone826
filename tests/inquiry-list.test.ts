import { describe, it, expect } from "vitest"
import {
  newInquiryIds,
  resolveSelectedId,
  newInquiryToast,
  escalationHeading,
  canRecordCustomerDetails,
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

describe("escalationHeading", () => {
  it("names the actual reason instead of always 'Identity Conflict'", () => {
    // The exact bug: a customer who'd already given complete booking info
    // but got stuck on vehicle-unit extraction read as an identity mismatch
    // that never happened.
    expect(escalationHeading('Bot asked 3× in a row for the same booking detail(s) (Vehicle Unit) with no progress. Handing to a human.'))
      .toBe("Missing Booking Details")
    expect(escalationHeading("Repeat booking: customer is already on file for plate ABC123 and re-submitted the same booking details."))
      .toBe("Duplicate Booking")
    expect(escalationHeading("Re-booking plate ABC123, currently in service (job status Ongoing). Customer was already informed once and is still pushing to book it."))
      .toBe("Vehicle Already In Service")
    expect(escalationHeading('Auto-escalated after repeated off-topic messages. Last message: "test".'))
      .toBe("Repeated Policy/Off-topic Messages")
    expect(escalationHeading('Auto-escalated: message classified as a possible threat or policy violation. Last message: "test".'))
      .toBe("Possible Threat")
    expect(escalationHeading('POSSIBLE IMPERSONATION. Messenger PSID 123 tried to claim Job Order ID JO-1.'))
      .toBe("Possible Impersonation")
    expect(escalationHeading("AI chatbot is disabled — routed to staff."))
      .toBe("AI Chatbot Disabled")
  })

  it("falls back to Identity Conflict for a genuine identity mismatch note", () => {
    expect(escalationHeading("Customer's provided phone number doesn't match the plate on file."))
      .toBe("Identity Conflict")
  })

  it("handles no note", () => {
    expect(escalationHeading(null)).toBe("Escalation Note")
    expect(escalationHeading(undefined)).toBe("Escalation Note")
  })
})

// Defect (TC-064): marking a Booking inquiry resolved removed the "Record
// Customer Details" button, so Sales couldn't record the customer afterwards.
describe("canRecordCustomerDetails", () => {
  it("is offered for a Booking inquiry while open AND after it is resolved", () => {
    expect(canRecordCustomerDetails({ type: "Booking", status: "open" })).toBe(true)
    expect(canRecordCustomerDetails({ type: "Booking", status: "resolved" })).toBe(true)
  })

  it("is not offered once already recorded", () => {
    expect(canRecordCustomerDetails({ type: "Booking", status: "recorded" })).toBe(false)
  })

  it("is only for Booking inquiries", () => {
    for (const type of ["Human Response", "Concern", "Status"]) {
      expect(canRecordCustomerDetails({ type, status: "open" })).toBe(false)
    }
  })
})
