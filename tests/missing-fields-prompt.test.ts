import { describe, it, expect } from "vitest"
import {
  buildMissingFieldsPrompt,
  MISSING_FIELDS_PROMPT_LEAD,
  missingBookingFields,
  dropUnsaidExamples,
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
        "• Full Name (e.g. Juan Dela Cruz)",
        "• Contact Number (e.g. 0917 123 4567)",
        "• Plate Number (e.g. ABC 1234)",
        "• Vehicle Unit (e.g. 2025 Black Toyota Vios)",
        "• Email Address (e.g. juan@email.com)",
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
        "• Buong pangalan (hal. Juan Dela Cruz)",
        "• Numero ng telepono (hal. 0917 123 4567)",
        "• Plate number (hal. ABC 1234)",
        "• Sasakyan (hal. 2025 Black Toyota Vios)",
        "• Email address (hal. juan@email.com)",
        "",
        "Pakipadala ang mga ito at ihahanda ko na ang booking mo.",
      ].join("\n"),
    )
    expect(out).not.toContain("Vehicle Unit")
    expect(out).not.toContain("Email Address")
  })

  it("keeps a single missing field short, without a one-item list", () => {
    expect(buildMissingFieldsPrompt(["Email Address"], "english")).toBe(
      "To continue your booking, please include: Email Address (e.g. juan@email.com).\n\nPlease send it and I'll get you set up.",
    )
    expect(buildMissingFieldsPrompt(["Email Address"], "filipino")).toBe(
      "Para maituloy ang iyong booking, pakisama: Email address (hal. juan@email.com).\n\nPakipadala ito at ihahanda ko na ang booking mo.",
    )
  })

  it("still starts with the lead-in that history scans look for, in both languages", () => {
    expect(buildMissingFieldsPrompt(all, "english").startsWith(MISSING_FIELDS_LEADS.english)).toBe(true)
    expect(buildMissingFieldsPrompt(all, "filipino").startsWith(MISSING_FIELDS_LEADS.filipino)).toBe(true)
  })
})

describe("dropUnsaidExamples", () => {
  const examples = {
    full_name: "Juan Dela Cruz",
    contact_number: "09171234567",
    plate_number: "ABC 1234",
    vehicle_unit: "2025 Black Toyota Vios",
    email: "juan@email.com",
  }
  const empty = { full_name: null, contact_number: null, plate_number: null, vehicle_unit: null, email: null }

  it("clears every example the customer never typed", () => {
    expect(dropUnsaidExamples(examples, ["Booking", "magkano po?"])).toEqual(empty)
    expect(dropUnsaidExamples({ ...empty, contact_number: "+63 917 123 4567" }, ["hello"])).toEqual(empty)
  })

  it("keeps a value the customer really typed, whatever the case or spacing", () => {
    const said = ["juan dela cruz, 0917-123-4567, abc1234", "black toyota vios 2025", "JUAN@EMAIL.COM"]
    expect(dropUnsaidExamples(examples, said)).toEqual(examples)
  })

  it("clears only the example fields and leaves real details alone", () => {
    const mixed = { ...examples, full_name: "Maria Santos", vehicle_unit: "2023 White Honda Civic" }
    expect(dropUnsaidExamples(mixed, ["Maria Santos", "2023 White Honda Civic"])).toEqual({
      ...empty,
      full_name: "Maria Santos",
      vehicle_unit: "2023 White Honda Civic",
    })
  })

  it("returns empty details unchanged", () => {
    expect(dropUnsaidExamples(empty, [])).toEqual(empty)
  })
})
