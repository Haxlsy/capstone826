import { z } from "zod"

/**
 * Shared field-level validation for `customer_record` — both create (POST
 * ./route.ts) and edit (PATCH ./[id]/route.ts) validate against this exact
 * schema, so the two can never drift into different standards for the same
 * table (edit used to accept anything; create required presence but never
 * checked format/length). Length caps mirror the DB columns exactly:
 * full_name VARCHAR(255), contact_number VARCHAR(20), email VARCHAR(255),
 * plate_number VARCHAR(50), vehicle_unit VARCHAR(255), psid VARCHAR(100)
 * (supabase/migrations/20260412000002_rebuild_schema.sql).
 */
const CustomerRecordFields = {
  full_name:      z.string().trim().min(1, "Full name is required.").max(255),
  contact_number: z.string().trim().min(1, "Contact number is required.").max(20),
  // A blank string clears the (optional) email column — kept distinct from a
  // malformed one, which is rejected.
  email: z.union([
    z.email({ message: "Enter a valid email address." }).max(255),
    z.literal(""),
  ]),
  plate_number: z.string().trim().min(1, "Plate number is required.").max(50),
  vehicle_unit: z.string().trim().min(1, "Vehicle unit is required.").max(255),
  psid:         z.string().trim().max(100),
}

export const CreateCustomerRecordSchema = z.object({
  full_name:      CustomerRecordFields.full_name,
  contact_number: CustomerRecordFields.contact_number,
  email:          CustomerRecordFields.email.optional().nullable(),
  plate_number:   CustomerRecordFields.plate_number,
  vehicle_unit:   CustomerRecordFields.vehicle_unit,
  psid:           CustomerRecordFields.psid.optional().nullable(),
})

// Every field optional — this endpoint supports a partial update (e.g.
// LinkAccountModal calls it with just `{ psid }`), but a field that IS
// present must still be valid, not silently dropped when falsy.
export const UpdateCustomerRecordSchema = z.object({
  full_name:      CustomerRecordFields.full_name.optional(),
  contact_number: CustomerRecordFields.contact_number.optional(),
  email:          CustomerRecordFields.email.optional().nullable(),
  plate_number:   CustomerRecordFields.plate_number.optional(),
  vehicle_unit:   CustomerRecordFields.vehicle_unit.optional(),
  psid:           CustomerRecordFields.psid.optional().nullable(),
})
