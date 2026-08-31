import { createAdminClient } from "@/lib/supabase/admin"
import { type CustomerDetails } from "@/types/chatbot"

export interface ActiveBooking {
  /**
   * True only when the customer has a real, qualifying active booking (a live
   * job order). An existing `customer_record` alone does NOT count as an active
   * booking — see docs/chatbot/AI_CHATBOT_OPENCODE_INSTRUCTION.md §14.
   */
  hasActiveBooking: boolean
  record?: {
    full_name:      string | null
    contact_number: string | null
    plate_number:   string | null
    vehicle_unit:   string | null
    email:          string | null
  }
  job?: {
    service_name: string | null
    status:       string
    scheduled_at: string | null
  }
}

// Job statuses that mean the customer's service is still live / not finished.
export const ACTIVE_JOB_STATUSES = [
  "Pending",
  "Ongoing",
  "For Rework",
  "For Release",
  "Delayed",
]

/**
 * Looks up whether a Messenger user (identified by their page-scoped id) already
 * has a booking on file. The `customer_record.psid` column is UNIQUE, so it is
 * the single source of truth for "this customer has booked with us before".
 *
 * Returns the customer's recorded details (`record`, when a customer_record
 * exists) plus their most recent live job order (`job`, when there is one).
 * `hasActiveBooking` is true ONLY when a live job exists — a customer_record
 * alone never means "you have an active booking".
 */
export async function lookupActiveBooking(psid: string): Promise<ActiveBooking> {
  const supabase = createAdminClient()

  const { data: record } = await supabase
    .from("customer_record")
    .select("id, full_name, contact_number, plate_number, vehicle_unit, email")
    .eq("psid", psid)
    .maybeSingle()

  if (!record) {
    return { hasActiveBooking: false }
  }

  const { data: job } = await supabase
    .from("job_order")
    .select(
      `id, status, scheduled_at,
       service:service_id(name)`
    )
    .eq("customer_record_id", record.id)
    .in("status", ACTIVE_JOB_STATUSES)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    hasActiveBooking: Boolean(job),
    record: {
      full_name:      record.full_name      ?? null,
      contact_number: record.contact_number ?? null,
      plate_number:   record.plate_number   ?? null,
      vehicle_unit:   record.vehicle_unit   ?? null,
      email:          record.email          ?? null,
    },
    job: job
      ? {
          service_name: serviceNameFromJob(job),
          status:       job.status,
          scheduled_at: job.scheduled_at,
        }
      : undefined,
  }
}

// PostgREST join shorthand (`service:service_id(name)`) resolves to a single
// object for many-to-one relations; defensively unwrap an array if present.
function serviceNameFromJob(
  job: { service?: { name?: string | null } | { name?: string | null }[] | null }
): string | null {
  if (Array.isArray(job.service)) return job.service[0]?.name ?? null
  return job.service?.name ?? null
}

/**
 * Renders an active-booking lookup result into a short, neutral block of text
 * that can be injected into the Gemini prompt as authoritative context.
 *
 * Only a real active booking (hasActiveBooking === true) renders the "existing
 * active booking" notice. A customer_record without a live job renders customer
 * context only, and never claims the customer has an active booking.
 */
export function formatActiveBooking(result: ActiveBooking): string | null {
  if (!result.record) return null

  const r = result.record
  const parts: string[] = []

  if (r.full_name) parts.push(`Customer on file: ${r.full_name}`)
  if (r.plate_number) parts.push(`Plate number: ${r.plate_number}`)
  if (r.vehicle_unit) parts.push(`Vehicle: ${r.vehicle_unit}`)
  if (r.contact_number) parts.push(`Contact: ${r.contact_number}`)

  if (result.job) {
    parts.push(`Active booking: ${result.job.service_name ?? "a service"} (status: ${result.job.status}).`)
  } else {
    parts.push("This customer has a customer record on file but no active booking/job right now.")
  }

  return parts.join("\n")
}

// Strict plate equality for dedup: "AAA-111" === "AAA 111" === "aaa111".
// Deliberately stricter than vehicle.ts's normalizePlate (which keeps dashes);
// importing that here would be circular (vehicle.ts imports from this file).
function platesEqual(a?: string | null, b?: string | null): boolean {
  const n = (s?: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  return n(a).length > 0 && n(a) === n(b)
}

/**
 * True when a completed booking is for a vehicle this psid is already on file
 * for — same plate, and a name compatible with the customer record. A same-plate
 * booking under an incompatible name is NOT this (it stays an identity conflict).
 */
export function isSameVehicleOnFile(
  record: ActiveBooking["record"] | null | undefined,
  extracted: CustomerDetails | null | undefined
): boolean {
  if (!record || !extracted) return false
  return (
    platesEqual(record.plate_number, extracted.plate_number) &&
    namesCompatible(record.full_name ?? "", extracted.full_name ?? "")
  )
}

/** Deterministic "you already have a booking on file" acknowledgement. */
export function buildDuplicateBookingNotice(
  record: ActiveBooking["record"] | null | undefined
): string {
  const plate = record?.plate_number ?? "your vehicle"
  const veh = record?.vehicle_unit ? ` (${record.vehicle_unit})` : ""
  return (
    `It looks like we already have your booking details on file for ${plate}${veh}. ` +
    "Our team will reach out to confirm your schedule. " +
    "If you'd like to book a different vehicle or need anything else, just let me know."
  )
}

export interface IdentityConflict {
  conflict: boolean
  nameConflict: boolean
  plateConflict: boolean
  /** Neutral, non-accusatory clarification instruction injected into the AI prompt. */
  clarification: string
  /** Concise note recorded on the inquiry when the booking is escalated. */
  note: string
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-zñáéíóú ]/g, "")
}

export function namesCompatible(a: string, b: string): boolean {
  const A = normalizeName(a)
  const B = normalizeName(b)
  if (!A || !B) return true
  if (A === B) return true
  if (A.includes(B) || B.includes(A)) return true
  const ta = A.split(" ")
  const tb = B.split(" ")
  // Same first name AND same surname (e.g. a dropped middle name) → same person.
  if (ta.length > 1 && tb.length > 1 && ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1]) {
    return true
  }
  return false
}

/**
 * Phase 4 (identity-conflict detection) — flags a booking whose details
 * contradict the canonical customer record instead of silently accepting them
 * (docs/chatbot/AI_CHATBOT_OPENCODE_INSTRUCTION.md §7 / §7.1 / Test 5):
 *
 * 1. Name conflict — the booking's full name is incompatible with the name on
 *    the customer_record for this psid (e.g. the record says "John", the
 *    booking says "Caleb"). Vehicle association is business context, not
 *    authentication — a name mismatch is surfaced and clarified, never a
 *    hard block.
 * 2. Plate conflict — the booking's plate number is already associated with a
 *    DIFFERENT customer_record (plate_number is UNIQUE). A plate owned by this
 *    same psid is not a conflict.
 *
 * The webhook never writes to customer_record from AI extraction, so nothing is
 * silently overwritten; this only detects the discrepancy so the AI can clarify
 * and Sales can verify.
 */
export async function lookupIdentityConflict(input: {
  psid: string
  extracted?: CustomerDetails | null
  record?: ActiveBooking["record"] | null
}): Promise<IdentityConflict | null> {
  const { psid, extracted, record } = input
  if (!extracted) return null

  let nameConflict = false
  let plateConflict = false

  if (record?.full_name && extracted.full_name) {
    nameConflict = !namesCompatible(record.full_name, extracted.full_name)
  }

  if (extracted.plate_number) {
    const supabase = createAdminClient()
    const { data: plateOwner } = await supabase
      .from("customer_record")
      .select("psid")
      .ilike("plate_number", extracted.plate_number.trim().toUpperCase())
      .limit(1)
      .maybeSingle()
    if (plateOwner && plateOwner.psid !== psid) plateConflict = true
  }

  if (!nameConflict && !plateConflict) return null

  const notes: string[] = []
  const asks: string[] = []
  if (nameConflict) {
    notes.push(`the name "${extracted.full_name}" differs from "${record?.full_name}" on the customer record`)
    asks.push("whether this booking is under a different name or is an update to their details")
  }
  if (plateConflict) {
    notes.push(`the plate number "${extracted.plate_number}" is already associated with another customer's record`)
    asks.push("them to confirm the correct plate number for their vehicle")
  }

  return {
    conflict: true,
    nameConflict,
    plateConflict,
    clarification:
      `The customer's booking details conflict with the customer record on file: ${notes.join(" and ")}. ` +
      `Ask a neutral clarification question (for example, ask ${asks.join(" and ")}). ` +
      "Do NOT escalate and do NOT finalize the booking until the customer confirms or corrects their details.",
    note: `Identity conflict: ${notes.join("; ")}.`,
  }
}
