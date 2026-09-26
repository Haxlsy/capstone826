/**
 * Who gets a job's Messenger updates (stage photos, "ready for release", …).
 *
 * One customer holds ONE unique Messenger account (`customer.psid`); their
 * vehicles (`customer_record`) reference the customer. A booking made FOR
 * SOMEONE ELSE from another customer's Messenger account is its own customer
 * with no account of their own, and the vehicle keeps a `booked_by` reference to
 * the customer whose account made it — a reference, not a copy, so relinking,
 * unlinking or deleting that account follows automatically.
 *
 * Both come from a single embed:
 *   customer:customer_record_id(…,
 *     owner:customer!customer_id(psid, …),
 *     booked_by:customer!booked_by_customer_id(psid))
 */
type One<T> = T | T[] | null | undefined
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

export type RecipientVia = "own" | "booked_by"

export interface VehicleWithOwners {
  owner?: One<{ psid?: string | null }>
  booked_by?: One<{ psid?: string | null }>
}

/** Who gets Messenger updates for this vehicle: its owner, else whoever booked it. */
export function recipientFromVehicle(
  vehicle: One<VehicleWithOwners>,
): { psid: string | null; via: RecipientVia | null } {
  const v = first(vehicle)
  const owner = first(v?.owner)?.psid
  if (owner) return { psid: owner, via: "own" }
  const booker = first(v?.booked_by)?.psid
  if (booker) return { psid: booker, via: "booked_by" }
  return { psid: null, via: null }
}
