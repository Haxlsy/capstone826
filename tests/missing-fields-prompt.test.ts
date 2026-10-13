import { describe, it, expect } from "vitest"
import {
  buildMissingFieldsPrompt,
  MISSING_FIELDS_PROMPT_LEAD,
  missingBookingFields,
} from "@/lib/messenger/chatbot"
import { MISSING_FIELDS_LEADS } from "@/lib/messenger/copy"

// The deterministic missing-fields re-ask (Testing Notes #8, #9): the bot's own
// text, so it can never rephrase-loop and never asks for a service type.

describe("buildMissingFieldsPrompt", () => {
  it("starts with the fixed lead-in the loop guard scans history for", () => {
    expect(buildMissingFieldsPrompt(["Email Address"]).startsWith(MISSING_FIELDS_PROMPT_LEAD)).toBe(true)
  })

  it("names the missing field and never asks about a service or package", () => {
    const out = buildMissingFieldsPrompt(["Email Address"])
    expect(out).toContain("Email Address")
    expect(out.toLowerCase()).not.toContain("service")
    expect(out.toLowerCase()).not.toContain("package")
  })

  it("lists several missing fields", () => {
    const out = buildMissingFieldsPrompt(["Plate Number", "Email Address"])
    expect(out).toContain("Plate Number")
    expect(out).toContain("Email Address")
    expect(out).toContain("them")
  })
})

describe("buildMissingFieldsPrompt layout", () => {
  const all = missingBookingFields(null)

  it("puts each missing field on its own line, with a blank line before the closing sentence", () => {
    expect(buildMissingFieldsPrompt(all, "english")).toBe(
      [
        "To continue your booking, please include:",
        "• Full Name",
        "• Contact Number",
        "• Plate Number",
        "• Vehicle Unit",
        "• Email Address",
        "",
        "Please send them and I'll get you set up.",
      ].join("\n"),
    )
  })

  it("is fully in Filipino, with no English field names left in", () => {
    const out = buildMissingFieldsPrompt(all, "filipino")
    expect(out).toBe(
      [
        "Para maituloy ang iyong booking, pakisama:",
        "• Buong pangalan",
        "• Numero ng telepono",
        "• Plate number",
        "• Sasakyan (brand at model)",
        "• Email address",
        "",
        "Pakipadala ang mga ito at ihahanda ko na ang booking mo.",
      ].join("\n"),
    )
    expect(out).not.toContain("Vehicle Unit")
    expect(out).not.toContain("Email Address")
  })

  it("keeps a single missing field short, without a one-item list", () => {
    expect(buildMissingFieldsPrompt(["Email Address"], "english")).toBe(
      "To continue your booking, please include: Email Address.\n\nPlease send it and I'll get you set up.",
    )
    expect(buildMissingFieldsPrompt(["Email Address"], "filipino")).toBe(
      "Para maituloy ang iyong booking, pakisama: Email address.\n\nPakipadala ito at ihahanda ko na ang booking mo.",
    )
  })

  it("still starts with the lead-in that history scans look for, in both languages", () => {
    expect(buildMissingFieldsPrompt(all, "english").startsWith(MISSING_FIELDS_LEADS.english)).toBe(true)
    expect(buildMissingFieldsPrompt(all, "filipino").startsWith(MISSING_FIELDS_LEADS.filipino)).toBe(true)
  })
})
