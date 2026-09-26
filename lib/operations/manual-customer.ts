import { normalizePhone } from "@/lib/phone"

/**
 * Add Job Order, manual entry, after the form auto-fetched an existing customer
 * (the "matched" one). Only the NAME is locked; plate, phone, email and vehicle
 * unit can be edited, so a returning customer can bring another vehicle. This
 * pure decision keeps the server's rules unit-testable; the route only does the
 * lookups and the writes.
 *
 *  - a plate on ANOTHER customer's vehicle          → 409 duplicate plate
 *  - an email / phone held by ANOTHER customer      → 409
 *  - a plate already among the matched customer's vehicles → that vehicle is
 *    reused (its unit corrected if edited)
 *  - a plate nobody has                             → a new vehicle for the
 *    same customer
 *  - edited phone / email                           → update the CUSTOMER
 *    (shared by all their vehicles; never locked)
 */
export interface MatchedCustomer {
  id: string
  full_name: string
  contact_number: string | null
  email: string | null
}

export interface MatchedVehicle {
  id: string
  customer_id: string
  /** The customer who booked it for someone else, if any — new vehicles inherit it. */
  booked_by_customer_id: string | null
}

export interface ManualEntry {
  phone: string | null | undefined
  email: string
  plate: string | null | undefined
  vehicle: string | null | undefined
}

export interface Snapshot {
  name: string
  contact_number: string | null
  plate_number: string | null
  vehicle_unit: string | null
}

export type ManualCustomerDecision =
  | { kind: "error"; status: number; message: string }
  | {
      kind: "ok"
      customerUpdates: { contact_number?: string; email?: string }
      vehicle:
        | { mode: "reuse"; id: string; updates: { vehicle_unit?: string } }
        | {
            mode: "create"
            insert: {
              customer_id: string
              plate_number: string
              vehicle_unit: string | null
              booked_by_customer_id: string | null
            }
          }
      snapshot: Snapshot
    }

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase()

export function decideManualCustomer(input: {
  customer: MatchedCustomer | null
  matchedVehicle: MatchedVehicle | null
  entry: ManualEntry
  /** The vehicle (if any) that already holds the typed plate. */
  plateOwner: { id: string; customer_id: string; vehicle_unit: string | null; plate_number: string } | null
  /** The customer (if any) that already holds the typed email. */
  emailOwner: { id: string } | null
  /** The customer (if any) that already holds the typed phone. */
  phoneOwner: { id: string } | null
}): ManualCustomerDecision {
  const { customer, matchedVehicle, entry, plateOwner, emailOwner, phoneOwner } = input

  if (!customer) {
    return {
      kind: "error",
      status: 409,
      message: "The selected customer no longer exists. Clear the form and enter the customer again.",
    }
  }

  const plate = (entry.plate ?? "").trim()
  if (!plate) return { kind: "error", status: 400, message: "Plate number is required." }

  if (plateOwner && plateOwner.customer_id !== customer.id) {
    return {
      kind: "error",
      status: 409,
      message: "That plate number is already on file for another customer record.",
    }
  }

  const email = entry.email.trim()
  if (email && emailOwner && emailOwner.id !== customer.id) {
    return { kind: "error", status: 409, message: "This email is already registered to another customer." }
  }

  const phone = normalizePhone(entry.phone) || (entry.phone ?? "").trim() || null
  if (phone && phoneOwner && phoneOwner.id !== customer.id) {
    return { kind: "error", status: 409, message: "That contact number is already on file for another customer." }
  }

  const customerUpdates: { contact_number?: string; email?: string } = {}
  if (phone && normalizePhone(customer.contact_number) !== normalizePhone(phone)) customerUpdates.contact_number = phone
  if (email && !same(customer.email, email)) customerUpdates.email = email

  const vehicleUnit = (entry.vehicle ?? "").trim() || null
  const snapshotContact = customerUpdates.contact_number ?? customer.contact_number

  if (plateOwner) {
    const updates: { vehicle_unit?: string } = {}
    if (vehicleUnit && !same(plateOwner.vehicle_unit, vehicleUnit)) updates.vehicle_unit = vehicleUnit
    return {
      kind: "ok",
      customerUpdates,
      vehicle: { mode: "reuse", id: plateOwner.id, updates },
      snapshot: {
        name: customer.full_name,
        contact_number: snapshotContact,
        plate_number: plateOwner.plate_number,
        vehicle_unit: updates.vehicle_unit ?? plateOwner.vehicle_unit,
      },
    }
  }

  return {
    kind: "ok",
    customerUpdates,
    vehicle: {
      mode: "create",
      insert: {
        customer_id: customer.id,
        plate_number: plate,
        vehicle_unit: vehicleUnit,
        booked_by_customer_id: matchedVehicle?.booked_by_customer_id ?? null,
      },
    },
    snapshot: { name: customer.full_name, contact_number: snapshotContact, plate_number: plate, vehicle_unit: vehicleUnit },
  }
}
