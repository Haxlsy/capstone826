import { describe, it, expect } from "vitest"
import {
  lockedEditMessage,
  pickActiveJobCodes,
  canDeleteCustomerRecord,
  deleteBlockedMessage,
  deleteConfirmMessage,
  CUSTOMER_RECORD_LOCKED_FIELDS,
} from "@/lib/sales/customer-record-lock"

describe("lockedEditMessage", () => {
  it("names the job order code", () => {
    expect(lockedEditMessage("JO-8X2K9F")).toContain("JO-8X2K9F")
  })
})

describe("pickActiveJobCodes", () => {
  it("locks a record with an active job, keyed by its code", () => {
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
  it("leaves a record with no job unlocked", () => {
    expect(pickActiveJobCodes([]).get("r1")).toBeUndefined()
  })
  it("resolves multiple different records independently", () => {
    const jobs = [
      { customer_record_id: "r1", job_order_code: "JO-1", status: "Pending" },
      { customer_record_id: "r2", job_order_code: "JO-2", status: "Released" },
      { customer_record_id: "r3", job_order_code: "JO-3", status: "For Rework" },
    ]
    const locked = pickActiveJobCodes(jobs)
    expect(locked.get("r1")).toBe("JO-1")
    expect(locked.has("r2")).toBe(false)
    expect(locked.get("r3")).toBe("JO-3")
  })
  it("keeps the first active job when a record somehow has more than one", () => {
    const jobs = [
      { customer_record_id: "r1", job_order_code: "JO-1", status: "Ongoing" },
      { customer_record_id: "r1", job_order_code: "JO-9", status: "Pending" },
    ]
    expect(pickActiveJobCodes(jobs).get("r1")).toBe("JO-1")
  })
})

describe("CUSTOMER_RECORD_LOCKED_FIELDS", () => {
  it("covers exactly the fields a linked job order displays, not psid", () => {
    expect(CUSTOMER_RECORD_LOCKED_FIELDS).toEqual(
      expect.arrayContaining(["full_name", "contact_number", "email", "plate_number", "vehicle_unit"]),
    )
    expect(CUSTOMER_RECORD_LOCKED_FIELDS as readonly string[]).not.toContain("psid")
  })
})

describe("canDeleteCustomerRecord", () => {
  it("allows deleting a record with no active job", () => {
    expect(canDeleteCustomerRecord(undefined)).toEqual({ ok: true })
    expect(canDeleteCustomerRecord(null)).toEqual({ ok: true })
  })
  it("blocks a record that is in service, naming the job order", () => {
    const r = canDeleteCustomerRecord("JO-8X2K9F")
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe(deleteBlockedMessage("JO-8X2K9F"))
      expect(r.reason).toContain("JO-8X2K9F")
    }
  })
})

describe("deleteConfirmMessage", () => {
  it("names the customer and plate, and says it can't be undone", () => {
    const m = deleteConfirmMessage({ fullName: "Harley Soldao", plateNumber: "ABC 1234", psid: null })
    expect(m).toContain("Harley Soldao")
    expect(m).toContain("ABC 1234")
    expect(m).toContain("can't be undone")
    expect(m).not.toContain("Messenger")
  })
  it("warns that a linked Messenger account is unlinked", () => {
    const m = deleteConfirmMessage({ fullName: "Harley Soldao", plateNumber: "ABC 1234", psid: "123" })
    expect(m).toContain("Messenger")
    expect(m).toContain("verify again")
  })
})
