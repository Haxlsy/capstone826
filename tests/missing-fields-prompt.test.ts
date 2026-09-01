import { describe, it, expect } from "vitest"
import {
  buildMissingFieldsPrompt,
  MISSING_FIELDS_PROMPT_LEAD,
} from "@/lib/messenger/chatbot"

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
