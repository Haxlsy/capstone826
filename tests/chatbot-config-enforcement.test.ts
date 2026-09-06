import { describe, it, expect } from "vitest"
import {
  sanitizeDetail,
  hasCancelIntent,
  hasExistingBookingIntent,
  shouldStayInBookingFlow,
  buildBookingSummary,
  buildSystemPrompt,
  buildFullSystemPrompt,
  formatKnowledgeBase,
  type ChatbotSettings,
} from "@/lib/messenger/chatbot"
import { quickRepliesFor } from "@/lib/messenger/handoff"

const settings: ChatbotSettings = {
  personality: "friendly",
  enable_ai_chatbot: true,
  enable_media_validation: true,
  ai_disabled_message: "Our team will get back to you shortly.",
  language: "english",
  operating_days: ["tue", "wed", "thu", "fri", "sat", "sun"],
  operating_open_time: "08:00",
  operating_close_time: "20:00",
  vehicle_status_message_en: "Not linked.",
  vehicle_status_message_fil: "Hindi naka-link.",
  link_verification_message_en: "Couldn't verify.",
  link_verification_message_fil: "Hindi na-verify.",
  escalation_message_en: "Handed to our team.",
  escalation_message_fil: "Ipinasa sa aming team.",
  resolved_message_en: "We're back.",
  resolved_message_fil: "Nandito na kami ulit.",
  booking_message_en: "A staff member will follow up to confirm your booking.",
  booking_message_fil: "Susundan ka ng staff namin para kumpirmahin ang booking.",
}

// ── Defect: model deliberation leaked into the customer's Vehicle line ──────
describe("sanitizeDetail", () => {
  it("rejects the exact leaked value the team saw in production", () => {
    const leaked =
      "SUV Toyota Fortuner (Toyota Fortuner SUV is a bit redundant, keeping as provided or " +
      "similar structure if allowed, here using 'SUV Toyota Fortuner' as provided by user). " +
      "Wait, let's use: SUV Toyota Fortuner"
    expect(sanitizeDetail(leaked)).toBeNull()
  })

  it("keeps ordinary values untouched", () => {
    expect(sanitizeDetail("Toyota Fortuner")).toBe("Toyota Fortuner")
    expect(sanitizeDetail("  ABC 1234  ")).toBe("ABC 1234")
    expect(sanitizeDetail("caleb@example.com")).toBe("caleb@example.com")
  })

  it("strips a parenthetical aside rather than losing the whole value", () => {
    expect(sanitizeDetail("Toyota Veloz (white)")).toBe("Toyota Veloz")
  })

  it("rejects multi-line, over-long, and multi-sentence values", () => {
    expect(sanitizeDetail("Toyota\nFortuner")).toBeNull()
    expect(sanitizeDetail("a".repeat(61))).toBeNull()
    expect(sanitizeDetail("Toyota Fortuner. Actually the customer meant a Vios")).toBeNull()
  })

  it("treats empty and non-string input as not provided", () => {
    expect(sanitizeDetail("")).toBeNull()
    expect(sanitizeDetail("   ")).toBeNull()
    expect(sanitizeDetail(null)).toBeNull()
    expect(sanitizeDetail(42)).toBeNull()
  })

  it("keeps a poisoned value out of the customer-facing summary", () => {
    const summary = buildBookingSummary({
      full_name: "Caleb James Dela Cruz",
      contact_number: "09491599567",
      plate_number: "OY 403B",
      vehicle_unit: "SUV Toyota Fortuner (redundant, keeping as provided). Wait, let's use: SUV",
      email: "sample@gmail.com",
    })
    expect(summary).not.toContain("Wait,")
    expect(summary).not.toContain("as provided")
    expect(summary).toContain("• Vehicle: —")
    expect(summary).toContain("Caleb James Dela Cruz")
  })
})

// ── Defect: "nevermind" / "cancel this booking" was never recognised ────────
describe("hasCancelIntent", () => {
  it("recognises plain abandonment in English and Filipino", () => {
    for (const msg of [
      "nevermind",
      "never mind",
      "nvm",
      "forget it",
      "changed my mind",
      "I don't want to book anymore",
      "cancel na lang",
      "wag na",
      "huwag na",
      "ayoko na",
      "hindi na lang",
    ]) {
      expect(hasCancelIntent(msg), msg).toBe(true)
    }
  })

  it("does not fire on ordinary booking conversation", () => {
    for (const msg of [
      "I want to book a detailing service",
      "my plate is ABC 1234",
      "yes",
      "what are your business hours?",
      "how much is ceramic coating",
    ]) {
      expect(hasCancelIntent(msg), msg).toBe(false)
    }
  })

  it("overlaps with existing-booking intent, which the webhook disambiguates", () => {
    // "cancel my booking" reads as both. The webhook resolves it by checking
    // whether a draft is in progress and whether a live job exists.
    expect(hasExistingBookingIntent("I want to cancel my booking")).toBe(true)
  })
})

// ── Defect: unrelated questions were answered with booking context appended ──
describe("shouldStayInBookingFlow", () => {
  const base = {
    signal: false,
    statusIntent: false,
    awaitingLinkVerification: false,
    linkEscalation: false,
    isBookingFlow: false,
    awaitingConfirmation: false,
    cancelIntent: false,
  }

  it("enters the flow on a fresh booking signal", () => {
    expect(shouldStayInBookingFlow({ ...base, signal: true })).toBe(true)
  })

  it("stays in while a confirmation is pending", () => {
    expect(shouldStayInBookingFlow({ ...base, awaitingConfirmation: true })).toBe(true)
  })

  it("does NOT drag an unrelated message in on a sticky flag alone", () => {
    // "October promo" mid-booking: no signal, no pending confirmation.
    expect(shouldStayInBookingFlow({ ...base, isBookingFlow: true })).toBe(false)
  })

  it("exits immediately when the customer cancels, even mid-confirmation", () => {
    expect(
      shouldStayInBookingFlow({ ...base, awaitingConfirmation: true, cancelIntent: true }),
    ).toBe(false)
  })

  it("yields to status intent and link verification", () => {
    expect(shouldStayInBookingFlow({ ...base, signal: true, statusIntent: true })).toBe(false)
    expect(shouldStayInBookingFlow({ ...base, signal: true, awaitingLinkVerification: true })).toBe(false)
    expect(shouldStayInBookingFlow({ ...base, signal: true, linkEscalation: true })).toBe(false)
  })
})

// ── Capabilities and escalation triggers are always on — no admin toggle ────
describe("always-on capabilities", () => {
  it("always lists every capability, with no way to turn one off", () => {
    const prompt = buildSystemPrompt(settings)
    expect(prompt).not.toContain("TURNED OFF")
    expect(prompt).toContain("Information about 826 Auto Care's services and pricing")
    expect(prompt).toContain("Collecting their details for a booking request")
    expect(prompt).toContain("Checking the current status of their vehicle's service job")
    expect(prompt).toContain("General FAQs about detailing and installation")
  })

  it("always lists all three escalation triggers", () => {
    const prompt = buildSystemPrompt(settings)
    expect(prompt).toMatch(/customer asks to speak with a human/i)
    expect(prompt).toMatch(/complaint or negative feedback/i)
    expect(prompt).toMatch(/on-topic 826 Auto Care question you cannot answer/i)
  })

  it("tells the model not to self-escalate off-topic/policy messages", () => {
    // Regression guard: the model used to set escalate=true for any message
    // it "couldn't answer" — including off-topic/hypothetical/threatening
    // ones — bypassing the graduated warning ladder entirely on message #1.
    const prompt = buildSystemPrompt(settings)
    expect(prompt).toMatch(/do not set "escalate" to true for an off-topic message/i)
  })

  it("always includes every quick-reply option", () => {
    const payloads = quickRepliesFor().map((q) => q.payload)
    expect(payloads).toEqual(expect.arrayContaining(["services", "booking", "status", "report"]))
  })
})

// ── Defect: hardcoded services beat the admin-managed knowledge base ────────
describe("knowledge base authority", () => {
  it("no longer ships a hardcoded service catalogue in the prompt", () => {
    const prompt = buildFullSystemPrompt(settings, null)
    // These came from the old BUSINESS_FACTS block.
    expect(prompt).not.toContain("Borophene Coating")
    expect(prompt).not.toContain("Nano Ceramic Tint")
    expect(prompt).not.toContain("Ortigas Ave Ext")
  })

  it("declares the knowledge base authoritative and puts it last", () => {
    const prompt = buildFullSystemPrompt(settings, "SERVICE:\n- PPF: film that protects paint")
    expect(prompt).toContain("authoritative")
    // lastIndexOf: the phrase also appears in the sourcing rules that introduce
    // the block; what matters is that the block itself comes after the guardrail.
    expect(prompt.lastIndexOf("BUSINESS KNOWLEDGE BASE")).toBeGreaterThan(prompt.indexOf("ABSOLUTE RESTRICTIONS"))
    expect(prompt.trimEnd().endsWith("film that protects paint")).toBe(true)
  })

  it("tells the model the knowledge base overrides earlier conversation turns", () => {
    // This is what stops a deleted entry surviving in replayed history.
    expect(buildFullSystemPrompt(settings, "x")).toMatch(/overrides anything said earlier/i)
  })

  it("forbids inventing services and prices when the base is empty", () => {
    const prompt = buildFullSystemPrompt(settings, null)
    expect(prompt).toMatch(/empty/i)
    expect(prompt).toMatch(/do not guess/i)
  })

  it("groups entries under category headings", () => {
    const out = formatKnowledgeBase([
      { category: "Pricing", topic: "PPF pricing", content: "From PHP 20,000" },
      { category: "Service", topic: "Full Body PPF", content: "Whole-vehicle film" },
      { category: null, topic: "Walk-ins", content: "Accepted" },
    ])
    expect(out).toContain("SERVICE:")
    expect(out).toContain("PRICING:")
    // A null category falls back to FAQ rather than being dropped.
    expect(out).toContain("FAQ:")
    expect(out!.indexOf("SERVICE:")).toBeLessThan(out!.indexOf("PRICING:"))
  })

  it("returns null for an empty knowledge base", () => {
    expect(formatKnowledgeBase([])).toBeNull()
  })
})
