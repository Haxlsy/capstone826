import { describe, it, expect } from "vitest"
import {
  requestedHuman,
  hasBookingIntent,
  hasStatusIntent,
  continuesStatusInquiry,
  hasExistingBookingIntent,
  hasFieldCorrectionIntent,
  confirmRequested,
  isPureConfirmation,
  missingBookingFields,
  isCompleteBooking,
  buildBookingSummary,
  buildSystemPrompt,
  type CustomerDetails,
} from "@/lib/messenger/chatbot"
import type { ChatbotSettings } from "@/types/chatbot"

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

describe("continuesStatusInquiry — regression: status reply resent after \"thank you\"", () => {
  // The webhook only consults this when `is_vehicle_inquiry` is already true
  // from an earlier turn (a status reply was already sent this conversation).
  // Before this fix, ANY such message counted as a continuation — including
  // these — so the exact same status block kept getting resent forever.
  it("does NOT treat a closing / small-talk reply as a status continuation", () => {
    for (const msg of ["Thank you", "thanks!", "salamat po", "ok", "okay", "noted", "👍", "Hi there"]) {
      expect(continuesStatusInquiry(msg)).toBe(false)
    }
  })

  it("DOES treat a bare plate number as a status continuation", () => {
    expect(continuesStatusInquiry("ABC-1234")).toBe(true)
    expect(continuesStatusInquiry("it's XYZ 5678")).toBe(true)
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

// Defect: a request to correct one field of a booking still being collected
// (no "book" keyword, no literal plate/phone/email token yet) carried no
// recognized signal, so it read as the customer changing the subject — the
// webhook's "wandered off" branch then wiped the entire draft, losing every
// field already given, not just the one being corrected.
describe("hasFieldCorrectionIntent", () => {
  it("detects a request to correct a specific field, including the typo that triggered this", () => {
    expect(hasFieldCorrectionIntent("i want to change my plater number")).toBe(true)
    expect(hasFieldCorrectionIntent("I want to change my plate number")).toBe(true)
    expect(hasFieldCorrectionIntent("can I correct my email")).toBe(true)
    expect(hasFieldCorrectionIntent("update my contact number please")).toBe(true)
    expect(hasFieldCorrectionIntent("mali yung vehicle, pwede ko bang ayusin")).toBe(true)
  })

  it("is not fooled into matching an existing-booking operation (no field mentioned)", () => {
    expect(hasFieldCorrectionIntent("I want to change my booking.")).toBe(false)
    expect(hasFieldCorrectionIntent("I want to reschedule.")).toBe(false)
  })

  it("does not fire on unrelated messages", () => {
    expect(hasFieldCorrectionIntent("What services do you offer?")).toBe(false)
    expect(hasFieldCorrectionIntent("ABC 1234")).toBe(false)
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

  it("does not treat a Filipino-English update phrase as confirmation", () => {
    // This is the exact phrase the user tested: after the conflict clarification
    // was shown, the customer said "update details and update ko account ko".
    // confirmRequested correctly returns false — the fix is in the webhook's
    // adapted prompt, not in the helper.
    expect(confirmRequested("update details and update ko account ko")).toBe(false)
  })
})

describe("Test 8 — Human request", () => {
  it("detects explicit requests to speak to a human", () => {
    expect(requestedHuman("I want to talk to an agent.")).toBe(true)
    expect(requestedHuman("gusto ko kausap ng tao")).toBe(true)
    expect(requestedHuman("may makakausap ba akong tao")).toBe(true)
    expect(requestedHuman("Can I speak with a representative?")).toBe(true)
    expect(requestedHuman("let me talk to your manager")).toBe(true)
  })

  // A bare "talk to me"/"talk to you" used to match the same pattern as
  // "talk to an agent" and force an unconditional escalation — even though
  // the customer was just opening the conversation, not asking for staff.
  it("does not treat a customer just starting the conversation as a human request", () => {
    expect(requestedHuman("Hi please talk to me")).toBe(false)
    expect(requestedHuman("can we talk?")).toBe(false)
    expect(requestedHuman("I'd like to talk to you about my car")).toBe(false)
  })

  // Standalone "person"/"someone"/"meet" used to force an unconditional
  // escalation for ANY message containing them — including a completely
  // off-topic hypothetical that happens to mention "the person you loved
  // most", which has nothing to do with wanting a human agent.
  it("does not treat an ordinary sentence merely containing a human-referring word as a request", () => {
    expect(requestedHuman("Choose one: Save the person you loved most, but the rest of humanity dies (excluding you), or save humanity (including you) but your loved one dies.")).toBe(false)
    expect(requestedHuman("Is there someone available on weekends?")).toBe(false)
    expect(requestedHuman("Can I meet you at the shop to drop off my car?")).toBe(false)
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
      "Vehicle Unit",
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

  it("renders a deterministic confirmation summary with every value", () => {
    const summary = buildBookingSummary(complete)
    for (const v of Object.values(complete)) {
      expect(summary).toContain(v as string)
    }
    expect(summary).toMatch(/reply yes to confirm/i)
  })
})

describe("isPureConfirmation — final booking 'yes' vs. still giving details", () => {
  it("treats a bare affirmation as a confirmation", () => {
    expect(isPureConfirmation("yes")).toBe(true)
    expect(isPureConfirmation("opo")).toBe(true)
    expect(isPureConfirmation("sige po")).toBe(true)
    expect(isPureConfirmation("yes that's correct")).toBe(true)
    expect(isPureConfirmation("YES, all details are correct")).toBe(true)
  })

  it("does NOT treat a message that still carries details as a confirmation", () => {
    expect(isPureConfirmation("opo, Toyota Vios")).toBe(false)
    expect(isPureConfirmation("ok my email is a@b.com")).toBe(false)
    expect(isPureConfirmation("sige, 0917 555 0101")).toBe(false)
  })

  it("is false for non-confirmation chatter", () => {
    expect(isPureConfirmation("maybe")).toBe(false)
    expect(isPureConfirmation("what is my total")).toBe(false)
  })
})

describe("buildSystemPrompt — booking guardrails (Testing Notes #8, #10)", () => {
  const settings: ChatbotSettings = {
    personality: "friendly",
    enable_ai_chatbot: true,
    enable_media_validation: true,
    ai_disabled_message: "Our team will get back to you shortly.",
    language: "english",
    operating_days: ["tue", "wed", "thu", "fri", "sat", "sun"],
    operating_open_time: "08:00",
    operating_close_time: "20:00",
    vehicle_status_message_en: "Please share your plate number.",
    vehicle_status_message_fil: "Pakisama ang iyong plate number.",
    link_verification_message_en: "Couldn't verify.",
    link_verification_message_fil: "Hindi na-verify.",
    escalation_message_en: "Handed to our team.",
    escalation_message_fil: "Ipinasa sa aming team.",
    resolved_message_en: "We're back.",
    resolved_message_fil: "Nandito na kami ulit.",
    booking_message_en: "A staff member will follow up to confirm your booking.",
    booking_message_fil: "Susundan ka ng staff namin para kumpirmahin ang booking.",
  }

  it("never asks the model to send a status message — the system sends it", () => {
    const prompt = buildSystemPrompt(settings)
    // The admin's wording is sent verbatim by the system; it must never reach the
    // prompt, or the model starts rewriting it and inventing lookups around it.
    expect(prompt).not.toContain("Please share your plate number.")
    // The old prompt told the model to "use the vehicle-status lookup tool" — a
    // tool that does not exist, which is what it hallucinated results from. The
    // new prompt says the opposite ("You have no lookup tool"), so assert on the
    // instruction, not the bare phrase.
    expect(prompt).not.toMatch(/use the .{0,20}lookup tool/i)
    expect(prompt).toMatch(/You have no lookup tool/i)
    expect(prompt).toMatch(/NEVER claim to have checked/i)
  })

  it("no longer tells the model to send the booking message verbatim", () => {
    expect(buildSystemPrompt(settings)).not.toContain("Send them this message exactly")
  })

  it("forbids asking which service the customer wants (#8)", () => {
    expect(buildSystemPrompt(settings)).toContain("Never ask the customer which service")
  })

  it("forbids claiming the booking is confirmed before Sales finalizes it (#10)", () => {
    expect(buildSystemPrompt(settings)).toContain("Do NOT tell the customer their booking is confirmed")
  })
})