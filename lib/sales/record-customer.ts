/**
 * Recording a booking from Sales: which customer does the new vehicle belong to?
 * (`customer.psid` is unique — one Messenger account = one customer.)
 *
 *  - The Messenger account already has a customer → add the vehicle to them.
 *  - The account has no customer yet → a new customer holding the psid.
 *  - No psid at all (walk-in) → reuse a customer with the same name and phone,
 *    else create one.
 *
 * (A booking made for another person from someone's account is not handled
 * here yet — `vehicle.booked_by_customer_id` exists for it, but recording it
 * is out of scope for now.)
 */
export type RecordCustomerDecision =
  | { kind: "use_existing"; customerId: string }
  | { kind: "create"; psid: string | null; bookedByCustomerId: string | null }

export function decideRecordCustomer(input: {
  psid: string | null | undefined
  /** The customer that already holds `psid`, if any. */
  customerByPsid: { id: string } | null
  /** A customer with the same name and normalised phone (walk-ins only). */
  sameNamePhoneCustomer: { id: string } | null
}): RecordCustomerDecision {
  const psid = input.psid?.trim() || null
  if (psid) {
    return input.customerByPsid
      ? { kind: "use_existing", customerId: input.customerByPsid.id }
      : { kind: "create", psid, bookedByCustomerId: null }
  }
  return input.sameNamePhoneCustomer
    ? { kind: "use_existing", customerId: input.sameNamePhoneCustomer.id }
    : { kind: "create", psid: null, bookedByCustomerId: null }
}
