import { describe, it, expect } from "vitest"
import { describeChatbotSettingsChanges } from "@/lib/admin/chatbot-settings-diff"
import type { ChatbotSettings } from "@/types/chatbot"

const base: ChatbotSettings = {
  personality: "friendly",
  enable_ai_chatbot: true,
  enable_media_validation: true,
  ai_disabled_message: "Our team will get back to you shortly.",
  operating_days: ["tue", "wed", "thu", "fri", "sat", "sun"],
  operating_open_time: "08:00",
  operating_close_time: "20:00",
  holidays: [],
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
  first_time_message_en: "Welcome!",
  first_time_message_fil: "Maligayang pagdating!",
}

describe("describeChatbotSettingsChanges", () => {
  it("returns a generic fallback when there is no prior settings row", () => {
    expect(describeChatbotSettingsChanges(null, base)).toBe("Chatbot settings")
  })

  it("returns a generic fallback when nothing actually differs", () => {
    expect(describeChatbotSettingsChanges(base, { ...base })).toBe("Chatbot settings")
  })

  it("reports AI Status for the chatbot toggle", () => {
    const next = { ...base, enable_ai_chatbot: false }
    expect(describeChatbotSettingsChanges(base, next)).toBe("AI Status")
  })

  it("reports AI Status for the media-validation toggle and the disabled message", () => {
    expect(describeChatbotSettingsChanges(base, { ...base, enable_media_validation: false })).toBe("AI Status")
    expect(describeChatbotSettingsChanges(base, { ...base, ai_disabled_message: "Different." })).toBe("AI Status")
  })

  it("reports AI Personality", () => {
    expect(describeChatbotSettingsChanges(base, { ...base, personality: "formal" })).toBe("AI Personality")
  })

  it("reports Operating Hours for any of the three operating-hours fields", () => {
    expect(describeChatbotSettingsChanges(base, { ...base, operating_open_time: "09:00" })).toBe("Operating Hours")
    expect(describeChatbotSettingsChanges(base, { ...base, operating_days: ["mon"] })).toBe("Operating Hours")
  })

  it("reports Holidays", () => {
    const next = { ...base, holidays: [{ date: "2026-12-25", label: "Christmas Day" }] }
    expect(describeChatbotSettingsChanges(base, next)).toBe("Holidays")
  })

  it("reports the specific template label, not a generic Message Templates", () => {
    const next = { ...base, booking_message_en: "New booking wording." }
    expect(describeChatbotSettingsChanges(base, next)).toBe("Booking Request Confirmation")
  })

  it("reports a template changed via only its Filipino field", () => {
    const next = { ...base, resolved_message_fil: "Bago na." }
    expect(describeChatbotSettingsChanges(base, next)).toBe("Resolved")
  })

  it("joins multiple simultaneous changes with a comma", () => {
    const next = {
      ...base,
      holidays: [{ date: "2026-12-25", label: "Christmas Day" }],
      booking_message_en: "New booking wording.",
    }
    expect(describeChatbotSettingsChanges(base, next)).toBe("Holidays, Booking Request Confirmation")
  })

  it("does not report unrelated fields as changed", () => {
    const next = { ...base, operating_open_time: "09:00" }
    const result = describeChatbotSettingsChanges(base, next)
    expect(result).not.toContain("Holidays")
    expect(result).not.toContain("AI Status")
    expect(result).not.toContain("Resolved")
  })
})
