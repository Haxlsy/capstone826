import { describe, it, expect } from "vitest"
import {
  chatbotSettingsSchema,
  chatbotSettingsSaveSchema,
  validateChatbotSettings,
  isWithinOperatingHours,
  DEFAULT_OPERATING_DAYS,
} from "@/types/chatbot"

const valid = {
  personality: "friendly",
  language: "english",
  enable_ai_chatbot: true,
  enable_media_validation: true,
  ai_disabled_message: "We'll get back to you.",
  operating_days: DEFAULT_OPERATING_DAYS,
  operating_open_time: "08:00",
  operating_close_time: "20:00",
  vehicle_status_message_en: "a", vehicle_status_message_fil: "a",
  link_verification_message_en: "a", link_verification_message_fil: "a",
  escalation_message_en: "a", escalation_message_fil: "a",
  resolved_message_en: "a", resolved_message_fil: "a",
  booking_message_en: "a", booking_message_fil: "a",
  first_time_message_en: "a", first_time_message_fil: "a",
}

describe("validateChatbotSettings", () => {
  it("accepts a complete config", () => {
    expect(validateChatbotSettings(valid as never)).toEqual({})
    expect(chatbotSettingsSaveSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ["vehicle_status_message_en", "Vehicle Status (English)"],
    ["link_verification_message_fil", "Link Verification (Filipino)"],
    ["escalation_message_en", "Human Escalation (English)"],
    ["resolved_message_fil", "Resolved (Filipino)"],
    ["booking_message_en", "Booking Request Confirmation (English)"],
  ])("rejects blank and whitespace-only %s", (field, label) => {
    for (const v of ["", "   \n "]) {
      const errs = validateChatbotSettings({ ...valid, [field]: v } as never)
      expect(errs[field]).toContain(label)
      const parsed = chatbotSettingsSaveSchema.safeParse({ ...valid, [field]: v })
      expect(parsed.success).toBe(false)
    }
  })

  it("requires the auto-reply only while the chatbot is off", () => {
    expect(validateChatbotSettings({ ...valid, ai_disabled_message: " " } as never)).toEqual({})
    const errs = validateChatbotSettings({ ...valid, enable_ai_chatbot: false, ai_disabled_message: " " } as never)
    expect(errs.ai_disabled_message).toBeTruthy()
  })

  it("requires at least one open day", () => {
    expect(validateChatbotSettings({ ...valid, operating_days: [] } as never).operating_days).toBeTruthy()
  })

  it("requires valid times with open before close", () => {
    expect(validateChatbotSettings({ ...valid, operating_open_time: "" } as never).operating_open_time).toBeTruthy()
    expect(validateChatbotSettings({ ...valid, operating_close_time: "25:00" } as never).operating_close_time).toBeTruthy()
    expect(validateChatbotSettings({ ...valid, operating_open_time: "20:00", operating_close_time: "08:00" } as never).operating_close_time).toBeTruthy()
    expect(validateChatbotSettings({ ...valid, operating_open_time: "08:00", operating_close_time: "08:00" } as never).operating_close_time).toBeTruthy()
  })

  it("keeps the read schema lenient about blank templates (stored/legacy rows, preview)", () => {
    const blank = { ...valid, vehicle_status_message_en: "", booking_message_fil: "" }
    expect(chatbotSettingsSchema.safeParse(blank).success).toBe(true)
    expect(chatbotSettingsSaveSchema.safeParse(blank).success).toBe(false)
  })
})

describe("isWithinOperatingHours", () => {
  // DEFAULT_OPERATING_DAYS closes Monday. 2026-01-05 is a Monday, 2026-01-06
  // a Tuesday — constructed with the local Date constructor (not a bare
  // "YYYY-MM-DD" string) so the weekday can't shift with timezone parsing.
  const monday  = (h: number, m = 0) => new Date(2026, 0, 5, h, m)
  const tuesday = (h: number, m = 0) => new Date(2026, 0, 6, h, m)
  const hours = { operating_days: DEFAULT_OPERATING_DAYS, operating_open_time: "08:00", operating_close_time: "20:00" }

  it("is ok on an open day within hours", () => {
    expect(isWithinOperatingHours(hours, tuesday(9, 0))).toEqual({ ok: true })
    expect(isWithinOperatingHours(hours, tuesday(8, 0))).toEqual({ ok: true }) // exactly opening
    expect(isWithinOperatingHours(hours, tuesday(20, 0))).toEqual({ ok: true }) // exactly closing
  })

  it("flags outside_hours before opening or after closing on an open day", () => {
    expect(isWithinOperatingHours(hours, tuesday(7, 59))).toEqual({ ok: false, reason: "outside_hours" })
    expect(isWithinOperatingHours(hours, tuesday(20, 1))).toEqual({ ok: false, reason: "outside_hours" })
  })

  it("flags closed_day even at a perfectly in-range time", () => {
    expect(isWithinOperatingHours(hours, monday(12, 0))).toEqual({ ok: false, reason: "closed_day" })
  })

  it("falls back sensibly for a legacy/empty operating_days config", () => {
    const legacy = { operating_days: [], operating_open_time: "08:00", operating_close_time: "20:00" }
    // Falls back to DEFAULT_OPERATING_DAYS rather than treating every day as closed.
    expect(isWithinOperatingHours(legacy, tuesday(9, 0)).ok).toBe(true)
  })
})
