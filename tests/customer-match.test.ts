import { describe, it, expect } from "vitest"
import {
  findMatch,
  applyTriggerEdit,
  clearMatch,
  plateConflict,
  emailConflict,
  type MatchState,
  type MatchableCustomer,
} from "@/lib/operations/customer-match"

const alyssa: MatchableCustomer = {
  customer_id:    "c-alyssa",
  full_name:      "Alyssa Gica",
  contact_number: "09173452378",
  email:          "Alyssa@Email.com",
  plate_number:   "DEV-168",
  vehicle_unit:   "SUV",
}
const other: MatchableCustomer = {
  customer_id:    "c-jacob",
  full_name:      "Jacob Evernight",
  contact_number: "09170000006",
  email:          null,
  plate_number:   "JAC 0006",
  vehicle_unit:   "Hyundai Tucson",
}
const customers = [alyssa, other]

const empty: MatchState<MatchableCustomer> = {
  matched: null,
  source:  null,
  fields:  { name: "", phone: "", email: "", plate: "", vehicle: "" },
}

describe("findMatch", () => {
  it("matches plate case-insensitively", () => {
    expect(findMatch(customers, "plate", "dev-168")).toBe(alyssa)
  })

  it("matches phone across formats", () => {
    expect(findMatch(customers, "phone", "0917-345-2378")).toBe(alyssa)
    expect(findMatch(customers, "phone", "+63 917 345 2378")).toBe(alyssa)
  })

  it("matches email ignoring case and surrounding whitespace", () => {
    expect(findMatch(customers, "email", "  alyssa@email.COM ")).toBe(alyssa)
  })

  it("never matches an empty value, or a record with no email", () => {
    expect(findMatch(customers, "plate", "  ")).toBeNull()
    expect(findMatch(customers, "phone", "")).toBeNull()
    expect(findMatch(customers, "email", "")).toBeNull()
  })

  it("matches only on the requested field", () => {
    expect(findMatch(customers, "plate", "09173452378")).toBeNull()
  })
})

describe("applyTriggerEdit", () => {
  it("fills every field and records which field found the match", () => {
    const next = applyTriggerEdit(empty, customers, "phone", "09173452378")
    expect(next.matched).toBe(alyssa)
    expect(next.source).toBe("phone")
    expect(next.fields).toEqual({
      name: "Alyssa Gica", phone: "09173452378", email: "Alyssa@Email.com",
      plate: "DEV-168", vehicle: "SUV",
    })
  })

  it("after a match, editing the plate keeps the customer and their locked name", () => {
    const matched = applyTriggerEdit(empty, customers, "phone", "09173452378")
    const next = applyTriggerEdit(matched, customers, "plate", "NEW-999")
    expect(next.matched).toBe(alyssa)
    expect(next.fields).toEqual({
      name: "Alyssa Gica", phone: "09173452378", email: "Alyssa@Email.com",
      plate: "NEW-999", vehicle: "SUV",
    })
  })

  it("after a match, editing the field that found it does not clear or re-fetch", () => {
    const matched = applyTriggerEdit(empty, customers, "phone", "09173452378")
    const next = applyTriggerEdit(matched, customers, "phone", "0917345237")
    expect(next.matched).toBe(alyssa)
    expect(next.source).toBe("phone")
    expect(next.fields.name).toBe("Alyssa Gica")
    expect(next.fields.plate).toBe("DEV-168")
    expect(next.fields.phone).toBe("0917345237")
  })

  it("typing another customer's phone after a match edits the field, it does not switch customer", () => {
    const matched = applyTriggerEdit(empty, customers, "phone", "09173452378")
    const next = applyTriggerEdit(matched, customers, "phone", "09170000006")
    expect(next.matched).toBe(alyssa)
    expect(next.fields.name).toBe("Alyssa Gica")
    expect(next.fields.phone).toBe("09170000006")
  })

  it("clearMatch returns a blank, unmatched form", () => {
    expect(clearMatch()).toEqual(empty)
  })

  it("only sets the field when nothing matches and nothing was matched", () => {
    const typed = applyTriggerEdit(
      { ...empty, fields: { ...empty.fields, name: "New Person" } },
      customers, "email", "new@person.com",
    )
    expect(typed.matched).toBeNull()
    expect(typed.fields).toEqual({ name: "New Person", phone: "", email: "new@person.com", plate: "", vehicle: "" })
  })
})

describe("plateConflict", () => {
  it("is null for the matched customer's own plate (a repeat job for the same vehicle)", () => {
    expect(plateConflict(customers, alyssa, "dev-168")).toBeNull()
  })
  it("returns another customer's record when the plate is theirs, case-insensitively", () => {
    expect(plateConflict(customers, alyssa, " jac 0006 ")).toBe(other)
  })
  it("is null for a plate nobody has, or an empty one", () => {
    expect(plateConflict(customers, alyssa, "NEW-999")).toBeNull()
    expect(plateConflict(customers, alyssa, "  ")).toBeNull()
  })
})

describe("emailConflict", () => {
  const alyssaSecondCar: MatchableCustomer = {
    customer_id: "c-alyssa",
    full_name: "Alyssa Gica", contact_number: "0917-345-2378", email: "second@email.com",
    plate_number: "DEV-169", vehicle_unit: "Van",
  }
  const list = [alyssa, alyssaSecondCar, { ...other, email: "jacob@email.com" }]

  it("is null for the matched customer's own email", () => {
    expect(emailConflict(list, alyssa, "alyssa@email.com")).toBeNull()
  })
  it("is null for an email on another vehicle of the same customer (same customer_id)", () => {
    expect(emailConflict(list, alyssa, "SECOND@email.com")).toBeNull()
  })
  it("returns the record when the email belongs to a different customer", () => {
    expect(emailConflict(list, alyssa, "jacob@email.com")?.full_name).toBe("Jacob Evernight")
  })
  it("is null with nothing matched, or an empty email", () => {
    expect(emailConflict(list, null, "jacob@email.com")).toBeNull()
    expect(emailConflict(list, alyssa, "")).toBeNull()
  })
})
