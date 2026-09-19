import { describe, it, expect } from "vitest"
import {
  findMatch,
  applyTriggerEdit,
  type MatchState,
  type MatchableCustomer,
} from "@/lib/operations/customer-match"

const alyssa: MatchableCustomer = {
  full_name:      "Alyssa Gica",
  contact_number: "09173452378",
  email:          "Alyssa@Email.com",
  plate_number:   "DEV-168",
  vehicle_unit:   "SUV",
}
const other: MatchableCustomer = {
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

  it("backspacing the field that found the match releases it (the reported lock)", () => {
    const matched = applyTriggerEdit(empty, customers, "phone", "09173452378")
    // Plate is still auto-filled with a value that matches — the old effect
    // re-matched through it and snapped the phone back. It must not now.
    const next = applyTriggerEdit(matched, customers, "phone", "0917345237")
    expect(next.matched).toBeNull()
    expect(next.source).toBeNull()
    expect(next.fields.phone).toBe("0917345237")
  })

  it("clears everything else the match had filled when it releases", () => {
    const matched = applyTriggerEdit(empty, customers, "plate", "DEV-168")
    const next = applyTriggerEdit(matched, customers, "plate", "DEV-16")
    expect(next.fields).toEqual({ name: "", phone: "", email: "", plate: "DEV-16", vehicle: "" })
  })

  it("works the same when the email is the trigger", () => {
    const matched = applyTriggerEdit(empty, customers, "email", "alyssa@email.com")
    expect(matched.source).toBe("email")
    const next = applyTriggerEdit(matched, customers, "email", "alyssa@email.co")
    expect(next.matched).toBeNull()
    expect(next.fields).toEqual({ name: "", phone: "", email: "alyssa@email.co", plate: "", vehicle: "" })
  })

  it("editing straight to another customer's value re-matches to them", () => {
    const matched = applyTriggerEdit(empty, customers, "phone", "09173452378")
    const next = applyTriggerEdit(matched, customers, "phone", "09170000006")
    expect(next.matched).toBe(other)
    expect(next.fields.name).toBe("Jacob Evernight")
    expect(next.fields.email).toBe("")
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
