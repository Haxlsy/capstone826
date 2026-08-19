import { createAdminClient } from "@/lib/supabase/admin"

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
const ACTIVE_JOB_STATUSES = [
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
