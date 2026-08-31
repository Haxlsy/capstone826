import { describe, it, expect } from "vitest"
import { isSameVehicleOnFile, buildDuplicateBookingNotice } from "@/lib/messenger/booking"
import type { CustomerDetails } from "@/types/chatbot"

const record = {
  full_name: "John Ashley Dulay",
  contact_number: "09664015109",
  plate_number: "AAA-111",
  vehicle_unit: "SUV",
  email: "ashley@gmail.com",
}

const booking = (over: Partial<CustomerDetails> = {}): CustomerDetails => ({
  full_name: "John Ashley Dulay",
  contact_number: "09664015109",
  plate_number: "AAA-111",
  vehicle_unit: "SUV",
  email: "ashley@gmail.com",
  ...over,
})

describe("isSameVehicleOnFile — duplicate booking detection", () => {
  it("matches an identical re-submission", () => {
    expect(isSameVehicleOnFile(record, booking())).toBe(true)
  })

  it("ignores plate formatting differences", () => {
    expect(isSameVehicleOnFile(record, booking({ plate_number: "aaa 111" }))).toBe(true)
    expect(isSameVehicleOnFile(record, booking({ plate_number: "AAA111" }))).toBe(true)
  })

  it("accepts a compatible name variant", () => {
    expect(isSameVehicleOnFile(record, booking({ full_name: "John Dulay" }))).toBe(true)
  })

  it("does NOT match a different plate", () => {
    expect(isSameVehicleOnFile(record, booking({ plate_number: "BBB-222" }))).toBe(false)
  })

  it("does NOT match the same plate under an incompatible name (stays an identity conflict)", () => {
    expect(isSameVehicleOnFile(record, booking({ full_name: "Caleb James Dela Cruz" }))).toBe(false)
  })

  it("is false when the record or extraction is missing", () => {
    expect(isSameVehicleOnFile(null, booking())).toBe(false)
    expect(isSameVehicleOnFile(record, null)).toBe(false)
    expect(isSameVehicleOnFile({ ...record, plate_number: null }, booking())).toBe(false)
  })
})

describe("buildDuplicateBookingNotice", () => {
  it("names the plate and promises a follow-up", () => {
    const msg = buildDuplicateBookingNotice(record)
    expect(msg).toContain("AAA-111")
    expect(msg).toMatch(/our team will reach out/i)
  })
})
