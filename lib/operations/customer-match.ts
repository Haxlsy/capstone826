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

  const key = FIELD_KEY[field]

  // A match just broke because the field that found it was edited — everything
  // else was auto-filled from that (now unrelated) record, so clear it rather
  // than leave a stale name/vehicle behind to end up on a different customer's
  // job order. Only what's being typed survives.
  if (state.matched) {
    return {
      matched: null,
      source:  null,
      fields:  { name: "", phone: "", email: "", plate: "", vehicle: "", [key]: value },
    }
  }

  return { ...state, fields: { ...state.fields, [key]: value } }
}
