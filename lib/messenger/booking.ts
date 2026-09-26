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
    /** The vehicle to talk about: the one with the live job, else the customer's first. */
    plate_number:   string | null
    vehicle_unit:   string | null
    email:          string | null
    /** Every vehicle the customer owns (a booking for any of them is a repeat, not a new one). */
    vehicles?: { plate_number: string | null; vehicle_unit: string | null }[]
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
 * has a booking on file. `customer.psid` is UNIQUE — one Messenger account is one
 * customer — so it is the single source of truth for "this customer has booked
 * with us before". The customer owns their vehicles (`customer_record`).
 *
 * Returns the customer's recorded details (`record`, when the customer exists)
 * plus their most recent live job order (`job`, when there is one) across ALL of
 * their vehicles and any vehicle this account booked for someone else.
 * `hasActiveBooking` is true ONLY when a live job exists — a customer on file
 * alone never means "you have an active booking".
 */
export async function lookupActiveBooking(psid: string): Promise<ActiveBooking> {
  const supabase = createAdminClient()

  const { data: customer } = await supabase
    .from("customer")
    .select("id, full_name, contact_number, email, vehicles:customer_record!customer_id(id, plate_number, vehicle_unit, created_at)")
    .eq("psid", psid)
    .maybeSingle()

  if (!customer) {
    return { hasActiveBooking: false }
  }

  const own = [...((customer.vehicles ?? []) as { id: string; plate_number: string | null; vehicle_unit: string | null; created_at: string }[])]
    .sort((x, y) => x.created_at.localeCompare(y.created_at))

  // Vehicles this account booked for another person count as this account's booking.
  const { data: bookedFor } = await supabase
    .from("customer_record")
    .select("id")
    .eq("booked_by_customer_id", customer.id)
  const vehicleIds = [...own.map((v) => v.id), ...((bookedFor ?? []) as { id: string }[]).map((v) => v.id)]

  const { data: job } = vehicleIds.length
    ? await supabase
        .from("job_order")
        .select(
          `id, status, scheduled_at, customer_record_id,
           service:service_id(name)`
        )
        .in("customer_record_id", vehicleIds)
        .in("status", ACTIVE_JOB_STATUSES)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const shown = (job && own.find((v) => v.id === (job as { customer_record_id?: string }).customer_record_id)) || own[0]

  return {
    hasActiveBooking: Boolean(job),
    record: {
      full_name:      customer.full_name    ?? null,
      contact_number: customer.contact_number ?? null,
      plate_number:   shown?.plate_number   ?? null,
      vehicle_unit:   shown?.vehicle_unit   ?? null,
      email:          customer.email        ?? null,
      vehicles:       own.map((v) => ({ plate_number: v.plate_number ?? null, vehicle_unit: v.vehicle_unit ?? null })),
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

export interface PlateInService {
  inService: boolean
  status?: string
  serviceName?: string | null
  customerName?: string | null
}

const stripPlate = (s: string | null | undefined): string =>
  (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")

/**
 * Looks up whether a plate number currently has a live job order with 826 Auto
 * Care — regardless of which account/psid booked it. Used by the booking flow to
 * refuse a new booking for a vehicle that is already in service.
 *
 * `job_order.plate_number` is denormalized free text, so rows are pulled and
 * matched in JS on a strict-normalized plate (dashes/spaces removed).
 */
export async function lookupActiveJobByPlate(plate: string): Promise<PlateInService> {
  const key = stripPlate(plate)
  if (!key) return { inService: false }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("job_order")
    .select(`status, plate_number, customer_name, service:service_id(name)`)
    .in("status", ACTIVE_JOB_STATUSES)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(200)

  const rows = (data ?? []) as {
    status: string
    plate_number: string | null
    customer_name: string | null
    service?: { name?: string | null } | { name?: string | null }[] | null
  }[]
  const hit = rows.find((j) => stripPlate(j.plate_number) === key)
  if (!hit) return { inService: false }

  return {
    inService: true,
    status: hit.status,
    serviceName: serviceNameFromJob(hit),
    customerName: hit.customer_name ?? null,
  }
}

/**
 * Deterministic "this vehicle is already in service" notice. Must contain
 * `plate ${normPlate}` and the literal phrase "currently in service" so the
 * webhook can detect (from conversation history) that the customer has already
 * been told, and escalate on a repeat push.
 */
export function buildVehicleInServiceNotice(
  normPlate: string,
  info?: PlateInService
): string {
  const status = info?.status ? ` (current status: ${info.status})` : ""
  return (
    `Your vehicle with plate ${normPlate} is currently in service with us${status}. ` +
    "We can't take a new booking for it until the current job is completed. " +
    "If you'd like to book a different vehicle, just send its plate number and details."
  )
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
 * The vehicle a completed booking repeats, when the psid's customer is already
 * on file for it — same plate as ANY of their vehicles, and a name compatible
 * with the customer. A same-plate booking under an incompatible name is NOT this
 * (it stays an identity conflict).
 */
export function findVehicleOnFile(
  record: ActiveBooking["record"] | null | undefined,
  extracted: CustomerDetails | null | undefined
): { plate_number: string | null; vehicle_unit: string | null } | null {
  if (!record || !extracted) return null
  if (!namesCompatible(record.full_name ?? "", extracted.full_name ?? "")) return null
  const vehicles = record.vehicles ?? [{ plate_number: record.plate_number, vehicle_unit: record.vehicle_unit }]
  return vehicles.find((v) => platesEqual(v.plate_number, extracted.plate_number)) ?? null
}

export function isSameVehicleOnFile(
  record: ActiveBooking["record"] | null | undefined,
  extracted: CustomerDetails | null | undefined
): boolean {
  return findVehicleOnFile(record, extracted) !== null
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
 * What to do with a complete booking this turn, given whether it conflicts with
 * the customer record on file and whether a conflict question was already asked.
 *
 * - "clarify":  first time the conflict shows up — ask, don't escalate.
 * - "escalate": the customer answered and the conflict is still there (they
 *   didn't correct the name/plate), so it's a booking for someone else that
 *   Sales must verify. There is deliberately no second "are you sure" round:
 *   the answer to the clarification IS the confirmation. (An escalation that
 *   waited for a separate confirmed "yes" was unreachable — the flow was
 *   dropped before it, because the answer carries no booking signal.)
 * - "proceed":  no conflict (or the customer corrected it / cancelled) — carry
 *   on with the normal confirm-and-hand-off path.
 */
export function conflictTurnAction(input: {
  conflict: boolean
  conflictPending: boolean
  cancelIntent: boolean
}): "clarify" | "escalate" | "proceed" {
  const { conflict, conflictPending, cancelIntent } = input
  if (!conflict || cancelIntent) return "proceed"
  return conflictPending ? "escalate" : "clarify"
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
    // The plate's vehicle belongs to a customer. It is this account's own if the
    // owner holds this psid (including their 2nd vehicle, which used to be
    // flagged) or if this account booked it for someone else; a vehicle owned by
    // any other customer — linked to another account or to none — is a conflict.
    const { data: plateVehicle } = await supabase
      .from("customer_record")
      .select("booked_by_customer_id, owner:customer!customer_id(psid)")
      .ilike("plate_number", extracted.plate_number.trim().toUpperCase().replace(/[\\%_]/g, "\\$&"))
      .limit(1)
      .maybeSingle()
    if (plateVehicle) {
      const owner = Array.isArray(plateVehicle.owner) ? plateVehicle.owner[0] : plateVehicle.owner
      if ((owner?.psid ?? null) !== psid) {
        let bookedByThisAccount = false
        if (plateVehicle.booked_by_customer_id) {
          const { data: booker } = await supabase
            .from("customer")
            .select("psid")
            .eq("id", plateVehicle.booked_by_customer_id)
            .maybeSingle()
          bookedByThisAccount = booker?.psid === psid
        }
        if (!bookedByThisAccount) plateConflict = true
      }
    }
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
