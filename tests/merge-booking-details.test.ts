import { describe, it, expect } from "vitest"
import {
  mergeBookingDetails,
  isCompleteBooking,
  missingBookingFields,
  type CustomerDetails,
} from "@/lib/messenger/chatbot"

const full: CustomerDetails = {
  full_name: "John Ashley Dulay",
  contact_number: "09664015109",
  plate_number: "ABC-111",
  vehicle_unit: "SUV",
  email: "dulay@gmail.com",
}
const empty: CustomerDetails = {
  full_name: null,
  contact_number: null,
  plate_number: null,
  vehicle_unit: null,
  email: null,
}

describe("mergeBookingDetails", () => {
  it("keeps a stored value when the incoming field is null", () => {
    expect(mergeBookingDetails(full, { ...empty, plate_number: "ABC-111" })).toEqual(full)
  })

  it("lets a non-null incoming value override the stored one (a correction)", () => {
    const out = mergeBookingDetails(full, { ...empty, plate_number: "XYZ-999" })
    expect(out.plate_number).toBe("XYZ-999")
    expect(out.full_name).toBe("John Ashley Dulay")
  })

  it("treats an empty / whitespace incoming string as null (keeps prev)", () => {
    const out = mergeBookingDetails(full, { ...empty, email: "   " })
    expect(out.email).toBe("dulay@gmail.com")
  })

  it("returns incoming as-is when there is no prior draft", () => {
    expect(mergeBookingDetails(null, full)).toEqual(full)
  })

  it("both null → null", () => {
    expect(mergeBookingDetails(empty, empty)).toEqual(empty)
    expect(mergeBookingDetails(null, null)).toEqual(empty)
  })

  it("the screenshot loop: a complete draft + a bare 'yes' turn stays complete", () => {
    // Turn 1 extracted all five → draft = full. Turn 2 the customer sends "yes"
    // and Gemini returns an all-null customer object. The merge must NOT regress.
    const merged = mergeBookingDetails(full, empty)
    expect(isCompleteBooking(merged)).toBe(true)
    expect(missingBookingFields(merged)).toEqual([])
  })

  it("accumulates details given across separate turns", () => {
    let draft = mergeBookingDetails(null, { ...empty, full_name: "Jane", plate_number: "AAA-111" })
    draft = mergeBookingDetails(draft, { ...empty, contact_number: "09170000000" })
    draft = mergeBookingDetails(draft, { ...empty, vehicle_unit: "Sedan", email: "jane@x.com" })
    expect(isCompleteBooking(draft)).toBe(true)
  })
})
