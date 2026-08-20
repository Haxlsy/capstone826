import { describe, it, expect } from "vitest"
import {
  requestedHuman,
  hasBookingIntent,
  hasStatusIntent,
  hasExistingBookingIntent,
  confirmRequested,
  missingBookingFields,
  isCompleteBooking,
  type CustomerDetails,
} from "@/lib/messenger/chatbot"

// Maps the §31 testing scenarios to the deterministic intent/decision helpers.
// Scenarios that require a live Gemini/Supabase/Messenger environment are
// manual smoke tests (see docs/chatbot/AI_CHATBOT_OPENCODE_INSTRUCTION.md §31).

describe("Test 1 — FAQ", () => {
  it("answers a services question without escalation or flow intents", () => {
    const msg = "What services do you offer?"
    expect(requestedHuman(msg)).toBe(false)
    expect(hasBookingIntent(msg)).toBe(false)
    expect(hasStatusIntent(msg)).toBe(false)
    expect(hasExistingBookingIntent(msg)).toBe(false)
  })

  it("does not treat an oil-change price question as a booking modification", () => {
    const msg = "How much is an oil change?"
    expect(hasExistingBookingIntent(msg)).toBe(false)
    expect(hasBookingIntent(msg)).toBe(false)
  })
})

describe("Test 2 — New booking", () => {
  it("detects booking intent", () => {
    expect(hasBookingIntent("I want to book.")).toBe(true)
    expect(hasBookingIntent("magpa-book po ako")).toBe(true)
    expect(hasBookingIntent("may appointment ako")).toBe(true)
  })
})

describe("Test 3 — Existing booking + another booking", () => {
  it("allows a second booking request (not treated as an existing-booking operation)", () => {
    const msg = "I want to book again."
    expect(hasBookingIntent(msg)).toBe(true)
    expect(hasExistingBookingIntent(msg)).toBe(false)
  })
})

describe("Test 4 — Existing booking modification", () => {
  it("detects change/cancel/modify/reschedule operations", () => {
    expect(hasExistingBookingIntent("I want to change my booking.")).toBe(true)
    expect(hasExistingBookingIntent("I want to cancel my booking.")).toBe(true)
    expect(hasExistingBookingIntent("I need to modify my appointment.")).toBe(true)
    expect(hasExistingBookingIntent("I want to reschedule.")).toBe(true)
    expect(hasExistingBookingIntent("pakansel po yung booking ko")).toBe(true)
  })
})

describe("Test 7 — Premature confirmation", () => {
  it("recognizes a confirmation phrase", () => {
    expect(confirmRequested("yes")).toBe(true)
    expect(confirmRequested("tama")).toBe(true)
    expect(confirmRequested("sige")).toBe(true)
  })

  it("does not treat unrelated chatter as confirmation", () => {
    expect(confirmRequested("maybe")).toBe(false)
    expect(confirmRequested("what is my total")).toBe(false)
  })
})

describe("Test 8 — Human request", () => {
  it("detects explicit requests to speak to a human", () => {
    expect(requestedHuman("I want to talk to an agent.")).toBe(true)
    expect(requestedHuman("gusto ko kausap ng tao")).toBe(true)
    expect(requestedHuman("may makakausap ba akong tao")).toBe(true)
  })
})

describe("Required booking information", () => {
  const complete: CustomerDetails = {
    full_name: "John Doe",
    contact_number: "09171234567",
    plate_number: "ABC-1234",
    vehicle_unit: "Ford",
    email: "john@example.com",
  }

  it("lists all five required fields when nothing is extracted", () => {
    expect(missingBookingFields(null)).toEqual([
      "Full Name",
      "Contact Number",
      "Plate Number",
      "Vehicle Type",
      "Email Address",
    ])
  })

  it("flags only the truly missing fields", () => {
    const partial: CustomerDetails = { ...complete, email: null }
    expect(missingBookingFields(partial)).toEqual(["Email Address"])
  })

  it("is complete only when all five fields are present", () => {
    expect(isCompleteBooking(complete)).toBe(true)
    expect(isCompleteBooking({ ...complete, plate_number: null })).toBe(false)
    expect(isCompleteBooking(null)).toBe(false)
  })
})