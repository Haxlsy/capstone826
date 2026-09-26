import { describe, it, expect } from "vitest"
import {
  pickActiveJobCodes,
  anyActiveCode,
  nameLockedMessage,
  vehicleLockedMessage,
  deleteVehicleBlockedMessage,
  deleteCustomerBlockedMessage,
  deleteVehicleConfirmMessage,
  deleteCustomerConfirmMessage,
  CUSTOMER_LOCKED_FIELDS,
  VEHICLE_LOCKED_FIELDS,
} from "@/lib/sales/customer-record-lock"

describe("messages", () => {
  it("name the job order code", () => {
    expect(nameLockedMessage("JO-8X2K9F")).toContain("JO-8X2K9F")
    expect(vehicleLockedMessage("JO-8X2K9F")).toContain("JO-8X2K9F")
    expect(deleteVehicleBlockedMessage("JO-8X2K9F")).toContain("JO-8X2K9F")
    expect(deleteCustomerBlockedMessage("JO-8X2K9F")).toContain("JO-8X2K9F")
  })
})

describe("locked fields", () => {
  it("only the customer's name is locked; phone/email never are", () => {
    expect([...CUSTOMER_LOCKED_FIELDS]).toEqual(["full_name"])
  })
  it("a vehicle's plate and unit are locked while it is in service", () => {
    expect([...VEHICLE_LOCKED_FIELDS]).toEqual(["plate_number", "vehicle_unit"])
  })
})

describe("pickActiveJobCodes", () => {
  it("locks a vehicle with an active job, keyed by its code", () => {
    const jobs = [{ customer_record_id: "r1", job_order_code: "JO-1", status: "Ongoing" }]
    expect(pickActiveJobCodes(jobs).get("r1")).toBe("JO-1")
  })
  it("does not lock a Released or Cancelled job", () => {
    const jobs = [
      { customer_record_id: "r1", job_order_code: "JO-1", status: "Released" },
      { customer_record_id: "r2", job_order_code: "JO-2", status: "Cancelled" },
    ]
    expect(pickActiveJobCodes(jobs).size).toBe(0)
  })
  it("leaves a vehicle with no job unlocked and ignores jobs with no vehicle", () => {
    expect(pickActiveJobCodes([]).get("r1")).toBeUndefined()
    expect(pickActiveJobCodes([{ customer_record_id: null, job_order_code: "JO-9", status: "Ongoing" }]).size).toBe(0)
  })
  it("resolves multiple different vehicles independently", () => {
    const jobs = [
      { customer_record_id: "r1", job_order_code: "JO-1", status: "Pending" },
      { customer_record_id: "r2", job_order_code: "JO-2", status: "Released" },
      { customer_record_id: "r3", job_order_code: "JO-3", status: "For Rework" },
    ]
    const m = pickActiveJobCodes(jobs)
    expect(m.get("r1")).toBe("JO-1")
    expect(m.has("r2")).toBe(false)
    expect(m.get("r3")).toBe("JO-3")
  })
})

describe("anyActiveCode", () => {
  it("is a code when any vehicle is active, else null", () => {
    expect(anyActiveCode(new Map([["r1", "JO-1"]]))).toBe("JO-1")
    expect(anyActiveCode(new Map())).toBeNull()
  })
})

describe("delete confirmations", () => {
  it("a vehicle delete says the customer stays", () => {
    const m = deleteVehicleConfirmMessage({ plateNumber: "HAX-127", vehicleUnit: "Vios" })
    expect(m).toContain("HAX-127")
    expect(m).toContain("customer and their other vehicles stay")
    expect(m).not.toContain("Messenger")
  })
  it("a customer delete names the customer and vehicle count", () => {
    const m = deleteCustomerConfirmMessage({ fullName: "Harley Soldao", vehicleCount: 2, psid: null })
    expect(m).toContain("Harley Soldao")
    expect(m).toContain("all 2 of their vehicles")
    expect(m).toContain("can't be undone")
    expect(m).not.toContain("Messenger")
  })
  it("warns that a linked Messenger account is unlinked when deleting a customer", () => {
    const m = deleteCustomerConfirmMessage({ fullName: "Harley Soldao", vehicleCount: 1, psid: "123" })
    expect(m).toContain("their 1 vehicle")
    expect(m).toContain("verify again")
  })
})
