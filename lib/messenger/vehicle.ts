import { createAdminClient } from "@/lib/supabase/admin"
import { computeExpectedCompletion } from "@/lib/job-estimates"
import { fmtDateTime } from "@/lib/time-display"
import { ACTIVE_JOB_STATUSES } from "@/lib/messenger/booking"
import { normalizePhone, isPlausibleMobile } from "@/lib/phone"

export { normalizePhone } from "@/lib/phone"

export interface JobStatus {
  plate:               string
  customerName:        string | null
  serviceName:         string | null
  status:              string
  currentStage:        string | null
  completedStages:     number
  totalStages:         number
  scheduledAt:         string | null
  expectedCompletionAt: string | null
}

/**
 * The result of resolving a Messenger customer's OWN vehicle status.
 *
 * Identity is established **only** from the page-scoped id (psid). A plate or
 * phone number appearing in a chat message is never used to look up data — the
 * status flow returns the vehicles registered to the requester's psid (matched
 * by the verified contact number on their customer_record), or nothing.
 *
 * `jobs` may be empty — that means "linked, but no vehicle currently in service".
 */
export type OwnVehicleOutcome =
  | { kind: "not_linked" }
  | { kind: "ok"; jobs: JobStatus[]; soft?: boolean }

export function normalizePlate(plate: string | null | undefined): string {
  return (plate ?? "").trim().toUpperCase().replace(/\s+/g, " ")
}

// Safety cap: if more than this many active jobs match a phone key, treat the
// key as unreliable (shared / placeholder number) and fall back to the psid
// record's own jobs only.
const MAX_JOBS_PER_PHONE = 8

interface JobRow {
  id: string
  status: string
  scheduled_at: string | null
  actual_start_at: string | null
  expected_completion_at: string | null
  customer_record_id: string | null
  plate_number: string | null
  contact_number: string | null
  service: any
  customer: any
}

async function buildJobStatus(
  supabase: ReturnType<typeof createAdminClient>,
  job: JobRow,
  fallbackName: string | null
): Promise<JobStatus> {
  const { data: stages } = await supabase
    .from("job_stage_progress")
    .select(
      `
       status,
       stage_duration_mins,
       service_stage:service_stage_id(name, sequence_order, stage_duration_mins)`
    )
    .eq("job_order_id", job.id)
    .order("sequence_order", { referencedTable: "service_stage", ascending: true })

  const ordered = (stages ?? [])
    .map((s: any) => {
      const rel = Array.isArray(s.service_stage) ? s.service_stage[0] : s.service_stage
      return {
        status: s.status,
        name: rel?.name ?? null,
        sequence_order: rel?.sequence_order ?? 0,
        duration_mins: (s.stage_duration_mins as number | null) ?? (rel?.stage_duration_mins ?? 0),
      }
    })
    .sort((a: any, b: any) => a.sequence_order - b.sequence_order)
  const total = ordered.length
  const completed = ordered.filter((s: any) => s.status === "done").length
  const active = ordered.find((s: any) => s.status !== "done")

  // Live estimate — recompute from schedule/actual + stage durations
  // (working-hours aware) instead of trusting the stored column.
  const totalDurationMins = ordered.reduce((acc: number, s: any) => acc + s.duration_mins, 0)
  const { expected } = computeExpectedCompletion({
    scheduled_at: job.scheduled_at,
    actual_start_at: job.actual_start_at,
    totalDurationMins,
  })
  const expectedCompletionAt = expected ?? (job.expected_completion_at ?? null)

  return {
    plate:           normalizePlate(job.plate_number ?? ""),
    customerName:    (Array.isArray(job.customer) ? job.customer[0]?.full_name : job.customer?.full_name) ?? fallbackName ?? null,
    serviceName:     (Array.isArray(job.service) ? job.service[0]?.name : job.service?.name) ?? null,
    status:          job.status,
    currentStage:    active?.name ?? null,
    completedStages: completed,
    totalStages:     total,
    scheduledAt:     job.scheduled_at,
    expectedCompletionAt,
  }
}

const JOB_SELECT = `id, status, scheduled_at, actual_start_at, expected_completion_at,
   customer_record_id, plate_number, contact_number,
   service:service_id(name),
   customer:customer_record_id(full_name)`

/**
 * Resolves the live status of every vehicle a Messenger customer has in service,
 * scoped strictly by their psid:
 *
 *   psid → customer_record → verified contact_number → all active job_orders
 *          for that person (own record + any record/job sharing the phone)
 *
 * There is no plate-based path. A customer can never retrieve status for a
 * vehicle that is not tied to their psid / verified phone number.
 */
export async function resolveOwnVehicleStatus(psid: string): Promise<OwnVehicleOutcome> {
  const supabase = createAdminClient()

  const { data: record } = await supabase
    .from("customer_record")
    .select("id, full_name, contact_number, plate_number, psid")
    .eq("psid", psid)
    .maybeSingle()

  if (!record) {
    // No linked customer_record yet — a customer who booked through Messenger
    // has an inquiry on file (with the plate / phone they gave) but Sales has
    // not recorded them yet. Soft-match their own inquiry against active jobs so
    // they can check status without a verification step. Nothing is written.
    const soft = await resolveInquirySoftMatch(supabase, psid)
    return soft ?? { kind: "not_linked" }
  }

  const canonicalPhone = normalizePhone(record.contact_number)
  const phoneKey = isPlausibleMobile(canonicalPhone) ? canonicalPhone : ""

  // Active jobs are a small, bounded set for a single shop — pull them and match
  // in JS against the person (own record id OR verified phone).
  const { data: activeJobs } = await supabase
    .from("job_order")
    .select(JOB_SELECT)
    .eq("is_archived", false)
    .in("status", ACTIVE_JOB_STATUSES)
    .order("created_at", { ascending: false })
    .limit(200)

  const rows = (activeJobs ?? []) as unknown as JobRow[]
  let mine = rows.filter(
    (j) =>
      j.customer_record_id === record.id ||
      (phoneKey !== "" && normalizePhone(j.contact_number) === phoneKey)
  )

  if (mine.length > MAX_JOBS_PER_PHONE) {
    console.warn("[vehicle] too many active jobs share this phone — scoping to psid record only", {
      psid,
      recordId: record.id,
      matched: mine.length,
    })
    mine = rows.filter((j) => j.customer_record_id === record.id)
  }

  const jobs = await Promise.all(
    mine.map((j) => buildJobStatus(supabase, j, record.full_name ?? null))
  )

  return { kind: "ok", jobs }
}

const stripPlateKey = (s: string | null | undefined): string =>
  normalizePlate(s ?? "").replace(/[^A-Z0-9]/g, "")

/**
 * Fallback identity resolution for a Messenger customer with no linked
 * customer_record: match the plate / phone they submitted in their OWN inquiry
 * rows against active job orders. Scoped entirely to this psid's inquiries;
 * nothing is written. Returns `null` when there is no confident match (caller
 * then falls back to the plate+phone verification ask).
 */
async function resolveInquirySoftMatch(
  supabase: ReturnType<typeof createAdminClient>,
  psid: string
): Promise<OwnVehicleOutcome | null> {
  const { data: inquiries } = await supabase
    .from("inquiry")
    .select("extracted_plate, extracted_contact, escalated_at")
    .eq("psid", psid)
    .order("escalated_at", { ascending: false })
    .limit(5)

  if (!inquiries?.length) return null

  const inqRows = inquiries as {
    extracted_plate: string | null
    extracted_contact: string | null
  }[]
  const plateKeys = new Set(
    inqRows.map((i) => stripPlateKey(i.extracted_plate)).filter(Boolean)
  )
  const phoneKeys = new Set(
    inqRows
      .map((i) => normalizePhone(i.extracted_contact))
      .filter((p) => isPlausibleMobile(p))
  )
  if (plateKeys.size === 0 && phoneKeys.size === 0) return null

  const { data: activeJobs } = await supabase
    .from("job_order")
    .select(JOB_SELECT)
    .eq("is_archived", false)
    .in("status", ACTIVE_JOB_STATUSES)
    .order("created_at", { ascending: false })
    .limit(200)

  const rows = (activeJobs ?? []) as unknown as JobRow[]

  const plateMatches = rows.filter((j) => plateKeys.has(stripPlateKey(j.plate_number)))
  // Prefer plate matches; only fall back to phone matches when no plate matched
  // (a mistyped phone in a past inquiry must not surface a stranger's vehicle).
  let mine =
    plateMatches.length > 0
      ? plateMatches
      : rows.filter(
          (j) => phoneKeys.size > 0 && phoneKeys.has(normalizePhone(j.contact_number))
        )

  if (mine.length === 0) return null
  if (mine.length > MAX_JOBS_PER_PHONE) {
    mine = rows.filter((j) => plateKeys.has(stripPlateKey(j.plate_number)))
    if (mine.length === 0) return null
  }

  const jobs = await Promise.all(mine.map((j) => buildJobStatus(supabase, j, null)))
  return { kind: "ok", jobs, soft: true }
}

const MISMATCH_TEXT =
  "The plate number the customer mentioned is NOT a vehicle registered to their Messenger account. " +
  "Do NOT share status for it and do NOT confirm any details about it. " +
  "Politely explain that we can only share updates for a vehicle booked under their own account/job order, " +
  "and offer to connect them with our team if they believe this is a mistake."

const NOT_LINKED_TEXT =
  "No vehicle is registered to this customer's Messenger account. Do NOT share any status. " +
  "Offer to verify their booking: ask for their plate number and the phone number on their booking, " +
  "or offer to connect them with our team."

const NO_ACTIVE_JOB_TEXT =
  "This customer has no vehicle currently in service. Tell them there is no active job order under their account. " +
  "If they just booked, their vehicle may not be checked in yet."

function renderJob(j: JobStatus): string {
  const stageLine = j.currentStage
    ? `Current stage: ${j.currentStage}`
    : "No stage is currently in progress."
  const progress = j.totalStages > 0
    ? `Progress: ${j.completedStages} of ${j.totalStages} stages completed.`
    : ""
  return [
    `Status for plate ${j.plate}: ${j.status}.`,
    `Service: ${j.serviceName ?? "not specified"} for ${j.customerName ?? "customer"}.`,
    stageLine,
    progress,
    j.expectedCompletionAt ? `Expected completion: ${fmtDateTime(j.expectedCompletionAt)}.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Renders an ownership-scoped status outcome into a short, neutral block of text
 * for injection into the Gemini prompt as authoritative context. No branch ever
 * emits another customer's job data.
 *
 * `focusPlate` — when the customer named one of their own plates, render only
 * that vehicle.
 */
export function formatOwnVehicleStatus(
  outcome: OwnVehicleOutcome,
  opts?: { plateMismatch?: boolean; focusPlate?: string }
): string {
  if (opts?.plateMismatch) return MISMATCH_TEXT
  if (outcome.kind === "not_linked") return NOT_LINKED_TEXT

  let jobs = outcome.jobs
  if (opts?.focusPlate) {
    const want = normalizePlate(opts.focusPlate)
    const only = jobs.filter((j) => normalizePlate(j.plate) === want)
    if (only.length > 0) jobs = only
  }

  if (jobs.length === 0) return NO_ACTIVE_JOB_TEXT
  if (jobs.length === 1) return renderJob(jobs[0])

  return (
    `The customer has ${jobs.length} vehicles currently in service. ` +
    "Give the update for the vehicle they asked about, or summarise all of them if they did not specify:\n\n" +
    jobs.map(renderJob).join("\n\n")
  )
}

export type LinkClaim =
  | { kind: "no_record" }                                  // nothing matches the plate
  | { kind: "match_unlinked"; recordName: string | null }  // record exists, psid null, phone matches
  | { kind: "phone_mismatch" }                             // record exists, psid null, phone wrong
  | { kind: "owned_by_other"; phoneMatched: boolean }      // record.psid is a different PSID
  | { kind: "owned_by_requester"; outcome: OwnVehicleOutcome } // defensive: psid already this user

/**
 * Assesses a Messenger customer's claim to an existing customer_record using the
 * plate number and the phone number on file. **Read-only** — it never links the
 * record. Account linking is a persistent access grant, so it is always
 * completed by Sales (after an out-of-band identity check) via the
 * customer-record edit form.
 *
 * The plate is resolved via `customer_record.plate_number` (UNIQUE) first, then
 * — for a returning customer whose 2nd car only exists as a job — via
 * `job_order.plate_number`.
 */
export async function assessLinkClaim(input: {
  psid: string
  plate: string
  phone: string
}): Promise<LinkClaim> {
  const supabase = createAdminClient()
  const plate = normalizePlate(input.plate)
  const phone = normalizePhone(input.phone)
  if (!plate || !isPlausibleMobile(phone)) return { kind: "no_record" }

  let record:
    | { id: string; full_name: string | null; contact_number: string | null; psid: string | null }
    | null = null

  const { data: byPlate } = await supabase
    .from("customer_record")
    .select("id, full_name, contact_number, psid")
    .ilike("plate_number", plate)
    .maybeSingle()
  record = byPlate ?? null

  if (!record) {
    // The plate may only exist on a job_order (manual 2nd car).
    const { data: job } = await supabase
      .from("job_order")
      .select("customer_record_id")
      .ilike("plate_number", plate)
      .not("customer_record_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (job?.customer_record_id) {
      const { data: r2 } = await supabase
        .from("customer_record")
        .select("id, full_name, contact_number, psid")
        .eq("id", job.customer_record_id)
        .maybeSingle()
      record = r2 ?? null
    }
  }

  if (!record) return { kind: "no_record" }

  const phoneMatched = normalizePhone(record.contact_number) === phone

  if (record.psid && record.psid === input.psid) {
    return { kind: "owned_by_requester", outcome: await resolveOwnVehicleStatus(input.psid) }
  }
  if (record.psid && record.psid !== input.psid) {
    return { kind: "owned_by_other", phoneMatched }
  }
  if (!phoneMatched) return { kind: "phone_mismatch" }

  return { kind: "match_unlinked", recordName: record.full_name ?? null }
}
