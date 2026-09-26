import { describe, it, expect } from "vitest"
import { decideManualCustomer, type MatchedCustomer, type MatchedVehicle } from "@/lib/operations/manual-customer"

const customer: MatchedCustomer = {
  id: "c1",
  full_name: "Alyssa Gica",
  contact_number: "09173452378",
  email: "alyssa@email.com",
}
const matchedVehicle: MatchedVehicle = { id: "v1", customer_id: "c1", booked_by_customer_id: null }
const ownVehicle = { id: "v1", customer_id: "c1", vehicle_unit: "SUV", plate_number: "DEV-168" }

const base = {
  customer,
  matchedVehicle,
  entry: { phone: "09173452378", email: "alyssa@email.com", plate: "DEV-168", vehicle: "SUV" },
  plateOwner: ownVehicle as typeof ownVehicle | null,
  emailOwner: { id: "c1" } as { id: string } | null,
  phoneOwner: { id: "c1" } as { id: string } | null,
}

describe("decideManualCustomer", () => {
  it("rejects when the matched customer no longer exists", () => {
    expect(decideManualCustomer({ ...base, customer: null })).toMatchObject({ kind: "error", status: 409 })
  })

  it("requires a plate", () => {
    const d = decideManualCustomer({ ...base, entry: { ...base.entry, plate: "  " }, plateOwner: null })
    expect(d).toMatchObject({ kind: "error", status: 400 })
  })

  it("rejects a plate on another customer's vehicle", () => {
    const d = decideManualCustomer({ ...base, plateOwner: { ...ownVehicle, id: "v9", customer_id: "c9" } })
    expect(d).toMatchObject({ kind: "error", status: 409 })
    expect((d as { message: string }).message).toContain("plate number")
  })

  it("reuses the vehicle untouched for the same plate with nothing edited", () => {
    const d = decideManualCustomer(base)
    expect(d).toMatchObject({ kind: "ok", customerUpdates: {}, vehicle: { mode: "reuse", id: "v1", updates: {} } })
    if (d.kind === "ok") expect(d.snapshot.name).toBe("Alyssa Gica")
  })

  it("corrects the vehicle unit and the customer's phone/email on a repeat job (phone normalised)", () => {
    const d = decideManualCustomer({
      ...base,
      entry: { phone: "+63 917 111 2222", email: "new@email.com", plate: "DEV-168", vehicle: "Toyota Fortuner" },
      emailOwner: null,
      phoneOwner: null,
    })
    expect(d.kind).toBe("ok")
    if (d.kind === "ok") {
      expect(d.customerUpdates).toEqual({ contact_number: "09171112222", email: "new@email.com" })
      expect(d.vehicle).toMatchObject({ mode: "reuse", updates: { vehicle_unit: "Toyota Fortuner" } })
      expect(d.snapshot.contact_number).toBe("09171112222")
    }
  })

  it("treats an email differing only by case as unchanged", () => {
    const d = decideManualCustomer({ ...base, entry: { ...base.entry, email: "ALYSSA@email.com" } })
    expect(d.kind === "ok" && d.customerUpdates).toEqual({})
  })

  it("adds another vehicle to the same customer when the plate is new", () => {
    const d = decideManualCustomer({
      ...base,
      entry: { phone: "09173452378", email: "alyssa@email.com", plate: " NEW-999 ", vehicle: "Ford Ranger" },
      plateOwner: null,
    })
    expect(d.kind).toBe("ok")
    if (d.kind === "ok") {
      expect(d.vehicle).toEqual({
        mode: "create",
        insert: { customer_id: "c1", plate_number: "NEW-999", vehicle_unit: "Ford Ranger", booked_by_customer_id: null },
      })
      expect(d.snapshot).toEqual({
        name: "Alyssa Gica", contact_number: "09173452378", plate_number: "NEW-999", vehicle_unit: "Ford Ranger",
      })
    }
  })

  it("the new vehicle inherits 'booked by' from the matched vehicle", () => {
    const d = decideManualCustomer({
      ...base,
      matchedVehicle: { ...matchedVehicle, booked_by_customer_id: "booker" },
      plateOwner: null,
      entry: { ...base.entry, plate: "NEW-1" },
    })
    expect(d.kind === "ok" && d.vehicle.mode === "create" && d.vehicle.insert.booked_by_customer_id).toBe("booker")
  })

  it("always uses the matched customer's name — the name is locked", () => {
    const d = decideManualCustomer({ ...base, plateOwner: null, entry: { ...base.entry, plate: "NEW-1" } })
    expect(d.kind === "ok" && d.snapshot.name).toBe("Alyssa Gica")
  })

  it("rejects an email held by a different customer", () => {
    const d = decideManualCustomer({ ...base, emailOwner: { id: "c7" } })
    expect(d).toMatchObject({ kind: "error", status: 409 })
    expect((d as { message: string }).message).toContain("email")
  })

  it("rejects a phone held by a different customer", () => {
    const d = decideManualCustomer({ ...base, phoneOwner: { id: "c7" } })
    expect(d).toMatchObject({ kind: "error", status: 409 })
    expect((d as { message: string }).message).toContain("contact number")
  })
})
