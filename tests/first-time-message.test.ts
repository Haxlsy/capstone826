import { describe, it, expect } from "vitest"
import {
  renderFirstTimeMessage,
  shouldSendFirstTimeMessage,
  validateChatbotSettings,
  chatbotSettingsSchema,
  chatbotSettingsSaveSchema,
  DEFAULT_FIRST_TIME_MESSAGE_EN,
  DEFAULT_FIRST_TIME_MESSAGE_FIL,
  DEFAULT_OPERATING_DAYS,
} from "@/types/chatbot"

describe("renderFirstTimeMessage", () => {
  it("inserts the customer's first name", () => {
    expect(renderFirstTimeMessage("Hi {name}!", "Juan Dela Cruz")).toBe("Hi Juan!")
  })
  it("falls back when the name is unknown", () => {
    expect(renderFirstTimeMessage("Hi {name}!", null)).toBe("Hi there!")
    expect(renderFirstTimeMessage("Hi {name}!", "  ", "filipino")).toBe("Hi kaibigan!")
    // The Graph lookup's failure placeholder must not become "Hi Messenger!"
    expect(renderFirstTimeMessage("Hi {name}!", "Messenger User")).toBe("Hi there!")
    expect(renderFirstTimeMessage("Hi {name}!", "Messenger User", "filipino")).toBe("Hi kaibigan!")
  })
  it("replaces every placeholder and leaves plain text alone", () => {
    expect(renderFirstTimeMessage("{name}, {NAME}", "Ana")).toBe("Ana, Ana")
    expect(renderFirstTimeMessage("Welcome!", "Ana")).toBe("Welcome!")
  })
  it("defaults contain the placeholder", () => {
    expect(DEFAULT_FIRST_TIME_MESSAGE_EN).toContain("{name}")
    expect(DEFAULT_FIRST_TIME_MESSAGE_FIL).toContain("{name}")
  })
})

describe("shouldSendFirstTimeMessage", () => {
  it("only on a new conversation with the AI on", () => {
    expect(shouldSendFirstTimeMessage({ isNewConversation: true, aiEnabled: true })).toBe(true)
    expect(shouldSendFirstTimeMessage({ isNewConversation: false, aiEnabled: true })).toBe(false)
    expect(shouldSendFirstTimeMessage({ isNewConversation: true, aiEnabled: false })).toBe(false)
  })
})

describe("first-time template validation", () => {
  const base = {
    personality: "friendly", language: "english", enable_ai_chatbot: true, enable_media_validation: true,
    ai_disabled_message: "x", operating_days: DEFAULT_OPERATING_DAYS,
    operating_open_time: "08:00", operating_close_time: "20:00",
    vehicle_status_message_en: "a", vehicle_status_message_fil: "a",
    link_verification_message_en: "a", link_verification_message_fil: "a",
    escalation_message_en: "a", escalation_message_fil: "a",
    resolved_message_en: "a", resolved_message_fil: "a",
    booking_message_en: "a", booking_message_fil: "a",
  }
  const full = { ...base, first_time_message_en: "Hi", first_time_message_fil: "Kumusta" }

  it("requires both languages on save", () => {
    expect(validateChatbotSettings(full as never)).toEqual({})
    expect(validateChatbotSettings({ ...full, first_time_message_en: " " } as never).first_time_message_en)
      .toContain("First Time Message (English)")
    expect(chatbotSettingsSaveSchema.safeParse(base).success).toBe(false)
  })
  it("still parses stored rows that predate the template", () => {
    expect(chatbotSettingsSchema.safeParse(base).success).toBe(true)
  })
})
