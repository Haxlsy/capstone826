import { normalizePhone } from "@/lib/phone"

/**
 * Pure rules for the Add Job Order form's "existing customer" auto-fill, kept
 * out of the component so they can be unit tested without a browser.
 *
 * The match is decided ONLY by the field currently being edited. Deriving it
 * from every field on every keystroke (the old behavior) meant an auto-fill
 * populated all of them, so backspacing one trigger field left another still
 * matching — which immediately re-filled the one being edited.
 */

export type MatchField = "plate" | "phone" | "email"

export interface MatchableCustomer {
  /** The person the vehicle belongs to (one customer can have several vehicles). */
  customer_id:    string
  full_name:      string
  contact_number: string
  email:          string | null
  plate_number:   string
  vehicle_unit:   string | null
}

export interface ManualCustomerFields {
  name:    string
  phone:   string
  email:   string
  plate:   string
  vehicle: string
}

export interface MatchState<C extends MatchableCustomer> {
  fields:  ManualCustomerFields
  matched: C | null
  source:  MatchField | null
}

export function findMatch<C extends MatchableCustomer>(
  customers: C[],
  field: MatchField,
  value: string,
): C | null {
  if (field === "plate") {
    const plate = value.trim().toLowerCase()
    if (!plate) return null
    return customers.find((c) => c.plate_number.trim().toLowerCase() === plate) ?? null
  }
  if (field === "phone") {
    const phone = normalizePhone(value)
    if (!phone) return null
    return customers.find((c) => normalizePhone(c.contact_number) === phone) ?? null
  }
  const email = value.trim().toLowerCase()
  if (!email) return null
  return customers.find((c) => (c.email ?? "").trim().toLowerCase() === email) ?? null
}

const FIELD_KEY: Record<MatchField, keyof ManualCustomerFields> = {
  plate: "plate",
  phone: "phone",
  email: "email",
}

export function applyTriggerEdit<C extends MatchableCustomer>(
  state: MatchState<C>,
  customers: C[],
  field: MatchField,
  value: string,
): MatchState<C> {
  const key = FIELD_KEY[field]

  // Once a customer has been fetched, plate / phone / email are ordinary
  // editable fields: the customer stays matched (their name stays locked) and
  // nothing is cleared or re-fetched, so a returning customer can be booked
  // with another vehicle. Duplicates are caught by plateConflict/emailConflict
  // below and, authoritatively, by the server.
  if (state.matched) {
    return { ...state, fields: { ...state.fields, [key]: value } }
  }

  const match = findMatch(customers, field, value)

  if (match) {
    return {
      matched: match,
      source:  field,
      fields: {
        name:    match.full_name,
        phone:   match.contact_number,
        email:   match.email ?? "",
        plate:   match.plate_number,
        vehicle: match.vehicle_unit ?? "",
      },
    }
  }

  return { ...state, fields: { ...state.fields, [key]: value } }
}

/** Back to a blank form — "not this customer". */
export function clearMatch<C extends MatchableCustomer>(): MatchState<C> {
  return { matched: null, source: null, fields: { name: "", phone: "", email: "", plate: "", vehicle: "" } }
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase()

/**
 * A typed plate that another customer record already holds. The matched
 * customer's own plate is not a conflict (a repeat job for the same vehicle).
 */
export function plateConflict<C extends MatchableCustomer>(
  customers: C[],
  matched: C | null,
  plate: string,
): C | null {
  const p = norm(plate)
  if (!p) return null
  if (matched && norm(matched.plate_number) === p) return null
  return customers.find((c) => norm(c.plate_number) === p) ?? null
}

/**
 * A typed email held by a DIFFERENT customer — not the matched one or any of
 * their vehicles (same `customer_id`). One email = one customer.
 */
export function emailConflict<C extends MatchableCustomer>(
  customers: C[],
  matched: C | null,
  email: string,
): C | null {
  const e = norm(email)
  if (!e || !matched) return null
  return customers.find((c) => norm(c.email) === e && c.customer_id !== matched.customer_id) ?? null
}
