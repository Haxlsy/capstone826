import { describe, it, expect } from "vitest"
import {
  extractDetailTokens,
  mergeBookingDetails,
  isCompleteBooking,
} from "@/lib/messenger/chatbot"

describe("extractDetailTokens", () => {
  it("pulls contact, email and plate from a clean comma-separated list", () => {
    const t = extractDetailTokens(
      "John Ashley Dulay, 09664015109, ABC-111, dulay@gmail.com, SUV"
    )
    expect(t.contact_number).toBe("09664015109")
    expect(t.email).toBe("dulay@gmail.com")
    expect((t.plate_number ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")).toBe("ABC111")
    expect(t.full_name).toBeNull()
    expect(t.vehicle_unit).toBeNull()
  })

  it("normalizes +63 / spaced / dashed phone forms to 09XXXXXXXXX", () => {
    expect(extractDetailTokens("+639664015109").contact_number).toBe("09664015109")
    expect(extractDetailTokens("0966 401 5109").contact_number).toBe("09664015109")
    expect(extractDetailTokens("0966-401-5109").contact_number).toBe("09664015109")
  })

  it("returns all null when there are no tokens", () => {
    expect(extractDetailTokens("yes")).toEqual({
      full_name: null,
      contact_number: null,
      plate_number: null,
      vehicle_unit: null,
      email: null,
    })
    expect(extractDetailTokens("hello, I want to book")).toMatchObject({
      contact_number: null,
      email: null,
    })
  })

  it("takes the last match when a value is corrected in one message", () => {
    const t = extractDetailTokens("not a@b.com, my email is c@d.com")
    expect(t.email).toBe("c@d.com")
  })

  it("recovers a booking that Gemini only half-extracted", () => {
    // Gemini returned name + plate + vehicle; tokens supply the rest.
    const gemini = {
      full_name: "John Ashley Dulay",
      contact_number: null,
      plate_number: "ABC-111",
      vehicle_unit: "SUV",
      email: null,
    }
    const merged = mergeBookingDetails(
      gemini,
      extractDetailTokens("09664015109, dulay@gmail.com")
    )
    expect(isCompleteBooking(merged)).toBe(true)
    expect(merged.contact_number).toBe("09664015109")
    expect(merged.email).toBe("dulay@gmail.com")
  })
})
