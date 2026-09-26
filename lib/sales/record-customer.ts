/**
 * Recording a booking from Sales: which customer does the new vehicle belong to?
 * (`customer.psid` is unique — one Messenger account = one customer.)
 *
 *  - The Messenger account already has a customer and the booking is theirs →
 *    add the vehicle to that customer.
 *  - …but the booking is FOR SOMEONE ELSE → a new customer (no Messenger
 *    account of their own) whose vehicle carries `booked_by` = the booker, so
 *    job updates still reach the account that booked it.
 *  - The account has no customer yet → a new customer holding the psid (the
 *    booker's own details are unknown, so there is nothing to link "booked by").
 *  - No psid at all (walk-in) → reuse a customer with the same name and phone,
 *    else create one.
 */
export type RecordCustomerDecision =
  | { kind: "use_existing"; customerId: string }
  | { kind: "create"; psid: string | null; bookedByCustomerId: string | null }

export function decideRecordCustomer(input: {
  psid: string | null | undefined
  forSomeoneElse: boolean
  /** The customer that already holds `psid`, if any. */
  customerByPsid: { id: string } | null
  /** A customer with the same name and normalised phone (walk-ins only). */
  sameNamePhoneCustomer: { id: string } | null
}): RecordCustomerDecision {
  const psid = input.psid?.trim() || null
  if (psid) {
    if (input.customerByPsid) {
      return input.forSomeoneElse
        ? { kind: "create", psid: null, bookedByCustomerId: input.customerByPsid.id }
        : { kind: "use_existing", customerId: input.customerByPsid.id }
    }
    return { kind: "create", psid, bookedByCustomerId: null }
  }
  return input.sameNamePhoneCustomer
    ? { kind: "use_existing", customerId: input.sameNamePhoneCustomer.id }
    : { kind: "create", psid: null, bookedByCustomerId: null }
}
