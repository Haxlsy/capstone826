import { describe, it, expect } from "vitest"
import { decideRecordCustomer } from "@/lib/sales/record-customer"

const base = { psid: "P1", forSomeoneElse: false, customerByPsid: null, sameNamePhoneCustomer: null }

describe("decideRecordCustomer", () => {
  it("adds the vehicle to the customer that already holds the Messenger account", () => {
    expect(decideRecordCustomer({ ...base, customerByPsid: { id: "c1" } })).toEqual({ kind: "use_existing", customerId: "c1" })
  })

  it("a booking for someone else is a new customer booked by the account holder", () => {
    expect(decideRecordCustomer({ ...base, customerByPsid: { id: "c1" }, forSomeoneElse: true })).toEqual({
      kind: "create", psid: null, bookedByCustomerId: "c1",
    })
  })

  it("a Messenger account with no customer yet becomes a new customer holding the psid", () => {
    expect(decideRecordCustomer(base)).toEqual({ kind: "create", psid: "P1", bookedByCustomerId: null })
    // 'for someone else' with an unknown booker still links the psid — nothing else to link to
    expect(decideRecordCustomer({ ...base, forSomeoneElse: true })).toEqual({ kind: "create", psid: "P1", bookedByCustomerId: null })
  })

  it("a walk-in reuses a customer with the same name and phone, else creates one", () => {
    expect(decideRecordCustomer({ ...base, psid: null, sameNamePhoneCustomer: { id: "c9" } })).toEqual({ kind: "use_existing", customerId: "c9" })
    expect(decideRecordCustomer({ ...base, psid: "  ", sameNamePhoneCustomer: null })).toEqual({ kind: "create", psid: null, bookedByCustomerId: null })
  })
})
