import { describe, it, expect } from "vitest"
import { jobCustomer } from "@/lib/operations/job-customer"
import { recipientFromVehicle } from "@/lib/messenger/recipient"

describe("jobCustomer", () => {
  it("reads the live vehicle and its owner", () => {
    const c = jobCustomer({
      customer_name: "Snapshot Name",
      contact_number: "0000",
      customer: {
        plate_number: "ABC 123",
        vehicle_unit: "Vios",
        owner: { full_name: "Harley Soldao", contact_number: "09158351532", email: "h@x.com" },
      },
    })
    expect(c).toEqual({
      name: "Harley Soldao", phone: "09158351532", email: "h@x.com", plate: "ABC 123", vehicle: "Vios",
    })
  })

  it("accepts PostgREST's array shapes", () => {
    const c = jobCustomer({ customer: [{ plate_number: "P", owner: [{ full_name: "N" }] }] })
    expect(c.name).toBe("N")
    expect(c.plate).toBe("P")
  })

  it("falls back to the job's own snapshot when the vehicle/customer is gone", () => {
    const c = jobCustomer({
      customer_name: "Walk In", contact_number: "0917", plate_number: "XYZ 1", vehicle_unit: "Civic", customer: null,
    })
    expect(c).toEqual({ name: "Walk In", phone: "0917", email: null, plate: "XYZ 1", vehicle: "Civic" })
  })

  it("is all null for a job with nothing", () => {
    expect(jobCustomer(null)).toEqual({ name: null, phone: null, email: null, plate: null, vehicle: null })
  })
})

describe("recipientFromVehicle", () => {
  it("the owner's Messenger account first", () => {
    expect(recipientFromVehicle({ owner: { psid: "o" }, booked_by: { psid: "b" } })).toEqual({ psid: "o", via: "own" })
  })
  it("a booking for someone else goes to whoever booked it", () => {
    expect(recipientFromVehicle({ owner: { psid: null }, booked_by: { psid: "b" } })).toEqual({ psid: "b", via: "booked_by" })
  })
  it("nobody reachable → null", () => {
    expect(recipientFromVehicle({ owner: { psid: null }, booked_by: null })).toEqual({ psid: null, via: null })
    expect(recipientFromVehicle(null)).toEqual({ psid: null, via: null })
  })
  it("accepts array-shaped embeds", () => {
    expect(recipientFromVehicle([{ owner: [{ psid: "o" }] }]).psid).toBe("o")
  })
})
