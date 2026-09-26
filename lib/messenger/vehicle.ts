import { createAdminClient } from "@/lib/supabase/admin"
import { computeExpectedCompletion } from "@/lib/job-estimates"
import { loadWorkSchedule } from "@/lib/operating-hours"
import { fmtDateTime } from "@/lib/time-display"
import { ACTIVE_JOB_STATUSES } from "@/lib/messenger/booking"
import { normalizePhone, isPlausibleMobile } from "@/lib/phone"
import { jobCustomer } from "@/lib/operations/job-customer"
import {
  DEFAULT_VEHICLE_STATUS_MESSAGE_EN,
  DEFAULT_VEHICLE_STATUS_MESSAGE_FIL,
  DEFAULT_LINK_VERIFICATION_MESSAGE_EN,
  DEFAULT_LINK_VERIFICATION_MESSAGE_FIL,
} from "@/types/chatbot"
import { STATUS_COPY, pickCopy, type BotLanguage, type MessageTemplate } from "@/lib/messenger/copy"

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
  | { kind: "booked_no_active_job"; plate: string | null }
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
  // (working-hours aware) instead of trusting the stored column. Loaded via
  // the same `supabase` client this function already receives, so the
  // chatbot's own answer always agrees with the current Operating Hours
  // setting rather than a separate, potentially stale source.
  const totalDurationMins = ordered.reduce((acc: number, s: any) => acc + s.duration_mins, 0)
  const schedule = await loadWorkSchedule(supabase)
  const { expected } = computeExpectedCompletion({
    scheduled_at: job.scheduled_at,
    actual_start_at: job.actual_start_at,
    totalDurationMins,
  }, schedule)
  const expectedCompletionAt = expected ?? (job.expected_completion_at ?? null)

  return {
    plate:           normalizePlate(job.plate_number ?? ""),
    customerName:    jobCustomer({ customer: job.customer }).name ?? fallbackName ?? null,
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
   customer:customer_record_id(plate_number, owner:customer!customer_id(full_name, contact_number))`

/** The plate / phone of the live vehicle + owner a job is linked to (not the job's own snapshot). */
const liveVehicle = (j: JobRow): { plate_number: string | null; contact_number: string | null } => {
  const v = Array.isArray(j.customer) ? j.customer[0] : j.customer
  const o = Array.isArray(v?.owner) ? v.owner[0] : v?.owner
  return { plate_number: v?.plate_number ?? null, contact_number: o?.contact_number ?? null }
}

const stripPlateKey = (s: string | null | undefined): string =>
  normalizePlate(s ?? "").replace(/[^A-Z0-9]/g, "")

/**
 * Resolves the live status of every vehicle a Messenger customer has in service.
 * Identity is resolved from the psid, in priority order:
 *
 *   1. The CUSTOMER that holds the psid (one Messenger account = one customer;
 *      Sales links it after verifying a walk-in). Their jobs = jobs on any of
 *      their vehicles, plus vehicles this account booked FOR someone else
 *      (`booked_by_customer_id`). The psid's inquiry history is ignored — a
 *      customer it used to be linked to must not leak.
 *   2. Otherwise, the psid's own UNHANDLED Messenger inquiries (status not yet
 *      `recorded`/`resolved`) — the grace window for a booker Sales hasn't
 *      recorded yet. A handled inquiry no longer confers identity.
 *
 * `not_linked` (→ verification ask) only when neither applies.
 */

export async function resolveOwnVehicleStatus(psid: string): Promise<OwnVehicleOutcome> {
  const supabase = createAdminClient()

  // Every identity signal this psid owns: the customer linked to it (set when
  // Sales records the inquiry) AND the plate / phone the customer gave in their
  // own Messenger inquiries. A psid with ANY of these has "booked through
  // Messenger" and must never hit the plate+phone verification wall — that ask
  // is only for a genuine stranger (no customer, no inquiry).
  const [{ data: customer }, { data: inquiries }] = await Promise.all([
    supabase
      .from("customer")
      .select("id, full_name, vehicles:customer_record!customer_id(id, plate_number)")
      .eq("psid", psid)
      .maybeSingle(),
    supabase
      .from("inquiry")
      .select("inquiry_type, status, extracted_plate, extracted_contact, escalated_at")
      .eq("psid", psid)
      .order("escalated_at", { ascending: false })
      .limit(5),
  ])
  const record = customer

  // Vehicles this account booked for another person (their own customer, no psid).
  const { data: bookedFor } = customer
    ? await supabase.from("customer_record").select("id, plate_number").eq("booked_by_customer_id", customer.id)
    : { data: [] as { id: string; plate_number: string | null }[] }

  const inqRows = (inquiries ?? []) as {
    inquiry_type: string | null
    status: string | null
    extracted_plate: string | null
    extracted_contact: string | null
  }[]
  // Only inquiries Sales has NOT yet processed confer identity. Once an inquiry
  // is recorded/resolved, the psid's identity is whatever customer it is (or is
  // not) linked to.
  const softInq = inqRows.filter((i) => i.status !== "recorded" && i.status !== "resolved")

  const plateKeys = new Set<string>()       // vehicle + inquiry plates — strong signal
  const softPhones = new Set<string>()      // inquiry-only phones — fallback match only
  const recordIds = new Set<string>()
  const addPlate = (p: string | null | undefined) => {
    const k = stripPlateKey(p)
    if (k) plateKeys.add(k)
  }
  const addPhone = (set: Set<string>, p: string | null | undefined) => {
    const k = normalizePhone(p)
    if (isPlausibleMobile(k)) set.add(k)
  }

  let firstPlate: string | null = null
  if (customer) {
    // A linked psid IS its customer. Their vehicles are matched by id / plate —
    // no phone aggregation is needed now that a customer owns its vehicles.
    const own = ((customer.vehicles ?? []) as { id: string; plate_number: string | null }[])
    for (const v of [...own, ...((bookedFor ?? []) as { id: string; plate_number: string | null }[])]) {
      recordIds.add(v.id)
      addPlate(v.plate_number)
    }
    firstPlate = own[0]?.plate_number ?? null
  } else {
    for (const i of softInq) {
      addPlate(i.extracted_plate)
      addPhone(softPhones, i.extracted_contact)
    }
  }

  // Genuine stranger — nothing on file to identify them by → ask to verify.
  if (recordIds.size === 0 && plateKeys.size === 0 && softPhones.size === 0) {
    console.log("[vehicle/status]", { psid, record: Boolean(record), inquiries: inqRows.length, softInquiries: softInq.length, result: "not_linked" })
    return { kind: "not_linked" }
  }

  const bookingPlate =
    softInq.find((i) => i.extracted_plate)?.extracted_plate ?? firstPlate

  const { data: activeJobs } = await supabase
    .from("job_order")
    .select(JOB_SELECT)
    .eq("is_archived", false)
    .in("status", ACTIVE_JOB_STATUSES)
    .order("created_at", { ascending: false })
    .limit(200)

  const rows = (activeJobs ?? []) as unknown as JobRow[]

  // A job is the customer's when it is linked to one of their vehicles or its
  // plate matches (its own denormalised value OR the vehicle it is linked to). An
  // inquiry-only phone is a weaker signal — used only when nothing stronger
  // matched.
  const idHit = (j: JobRow) => j.customer_record_id != null && recordIds.has(j.customer_record_id)
  const plateHit = (j: JobRow) =>
    plateKeys.has(stripPlateKey(j.plate_number)) ||
    plateKeys.has(stripPlateKey(liveVehicle(j).plate_number))
  const softPhoneHit = (j: JobRow) =>
    softPhones.size > 0 &&
    (softPhones.has(normalizePhone(j.contact_number)) ||
      softPhones.has(normalizePhone(liveVehicle(j).contact_number)))

  let mine = rows.filter((j) => idHit(j) || plateHit(j))
  if (mine.length === 0) {
    mine = rows.filter(softPhoneHit)
    // A shared / placeholder number matching this many jobs is not one customer.
    if (mine.length > MAX_JOBS_PER_PHONE) mine = rows.filter((j) => idHit(j) || plateHit(j))
  }

  console.log("[vehicle/status]", {
    psid,
    record: Boolean(record),
    inquiries: inqRows.length,
    softInquiries: softInq.length,
    plateKeys: [...plateKeys],
    softPhones: [...softPhones],
    activeJobs: rows.length,
    matched: mine.length,
    result: mine.length > 0 ? "ok" : record ? "ok-empty" : "booked_no_active_job",
  })

  if (mine.length === 0) {
    // No job matched. A recorded customer with nothing in service → the existing
    // "no active job" message. A psid we only know from their inquiry → the
    // friendly "booking received, not scheduled yet" reply. Neither asks them to
    // verify their identity.
    if (record) return { kind: "ok", jobs: [] }
    return { kind: "booked_no_active_job", plate: bookingPlate ? normalizePlate(bookingPlate) || null : null }
  }

  const jobs = await Promise.all(
    mine.map((j) => buildJobStatus(supabase, j, customer?.full_name ?? null))
  )
  return record ? { kind: "ok", jobs } : { kind: "ok", jobs, soft: true }
}

const MISMATCH_TEXT =
  "The plate number the customer mentioned is NOT a vehicle registered to their Messenger account. " +
  "Do NOT share status for it and do NOT confirm any details about it. " +
  "Politely explain that we can only share updates for a vehicle booked under their own account/job order, " +
  "and offer to connect them with our team if they believe this is a mistake."

const NOT_LINKED_TEXT =
  "This Messenger account is not linked to any customer record, so NOTHING was looked up. " +
  "Do NOT share any status. Do NOT claim to have checked, searched, or reviewed our system. " +
  "Do NOT state whether any Job Order ID has a job order — no such lookup was performed. " +
  "Explain only that their Messenger account is not yet linked to a customer record, ask for " +
  "the Job Order ID on their receipt/booking confirmation so their account can be linked, " +
  "or offer to connect them with our team."

/**
 * The customer-facing account-linking ask. Sent verbatim (no Gemini) whenever an
 * unlinked psid requests vehicle status, and again on a failed attempt:
 *
 *   (no `retry`)   — the FIRST ask, using the admin's "Vehicle Status Message
 *                    Template" (`vehicleStatusTemplate`).
 *   `unrecognized` — no readable Job Order Code, or the code doesn't match any
 *                    job order on file.
 *   `conflict`     — the code matched a record already linked to a DIFFERENT
 *                    Messenger account.
 *
 * `unrecognized` and `conflict` both use the admin's "Link Verification
 * Message Template" (`linkVerificationTemplate`) and deliberately share the
 * exact same wording: a reply that distinguished them would be an
 * enumeration oracle — anyone could probe codes and learn which ones are
 * registered purely from which reply came back. The message must stay silent
 * about why verification failed, and must never confirm or deny that a code
 * exists or belongs to somebody.
 *
 * Both templates are pre-resolved against their built-in default by the
 * caller (via `resolveTemplate` in lib/messenger/copy.ts) — a cleared admin
 * setting can never send an empty message.
 *
 * It must never say a code "has no job order": identity comes from the psid, and
 * for an unlinked account no code lookup happens until the customer sends one.
 */
export function buildLinkVerificationPrompt(opts: {
  retry?: "unrecognized" | "conflict"
  lang?: BotLanguage
  vehicleStatusTemplate?: MessageTemplate | null
  linkVerificationTemplate?: MessageTemplate | null
}): string {
  if (opts.retry === "unrecognized" || opts.retry === "conflict") {
    const t = opts.linkVerificationTemplate ??
      { en: DEFAULT_LINK_VERIFICATION_MESSAGE_EN, fil: DEFAULT_LINK_VERIFICATION_MESSAGE_FIL }
    return pickCopy(opts.lang, t.en, t.fil)
  }

  const t = opts.vehicleStatusTemplate ??
    { en: DEFAULT_VEHICLE_STATUS_MESSAGE_EN, fil: DEFAULT_VEHICLE_STATUS_MESSAGE_FIL }
  return pickCopy(opts.lang, t.en, t.fil)
}

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
  if (outcome.kind === "booked_no_active_job") {
    const p = outcome.plate ? ` for plate ${outcome.plate}` : ""
    return (
      `The customer has a booking${p} on file but there is no active job order yet — ` +
      "the work has not been scheduled or started. Tell them their booking has been " +
      "received and our team will update them here once it is scheduled or work begins. " +
      "Do NOT ask them to verify their identity and do NOT escalate."
    )
  }

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

/**
 * Renders the status outcome as a customer-facing message sent DIRECTLY to
 * Messenger (no Gemini). The model was unreliable here — it kept sending the
 * "please provide your details" template even when the status was already known,
 * and on `not_linked` it invented lookups it never ran ("no active job order for
 * plate XYZ-1234"). Every outcome is now deterministic; only `plateMismatch` is
 * still handled by the model in prose, via `formatOwnVehicleStatus`.
 */
export function formatVehicleStatusForCustomer(
  outcome: OwnVehicleOutcome,
  opts?: { focusPlate?: string; vehicleStatusTemplate?: MessageTemplate | null; lang?: BotLanguage }
): string | null {
  // The admin's configured wording applies ONLY here — a linked customer's job
  // status is assembled from live data and is never affected by the setting.
  if (outcome.kind === "not_linked") {
    return buildLinkVerificationPrompt({ lang: opts?.lang, vehicleStatusTemplate: opts?.vehicleStatusTemplate })
  }

  if (outcome.kind === "booked_no_active_job") {
    return STATUS_COPY.bookedNoActiveJob(outcome.plate, opts?.lang)
  }

  let jobs = outcome.jobs
  if (opts?.focusPlate) {
    const want = normalizePlate(opts.focusPlate)
    const only = jobs.filter((j) => normalizePlate(j.plate) === want)
    if (only.length > 0) jobs = only
  }

  if (jobs.length === 0) {
    return STATUS_COPY.noVehicleInService(opts?.lang)
  }

  const L = opts?.lang === "filipino" ? STATUS_COPY.jobLabels.filipino : STATUS_COPY.jobLabels.english

  const one = (j: JobStatus): string => {
    const lines = [`${L.plate}: ${j.plate}`, `${L.status}: ${j.status}`]
    if (j.serviceName) lines.push(`${L.service}: ${j.serviceName}`)
    if (j.totalStages > 0) {
      lines.push(
        `${L.progress}: ${j.completedStages} of ${j.totalStages} ${L.stagesDone}` +
          (j.currentStage ? ` (${L.currently}: ${j.currentStage})` : "")
      )
    }
    if (j.expectedCompletionAt) lines.push(`${L.eta}: ${fmtDateTime(j.expectedCompletionAt)}`)
    return lines.join("\n")
  }

  const body = jobs.map(one).join("\n\n")
  return `${STATUS_COPY.latestHeader(jobs.length > 1, opts?.lang)}\n\n${body}`
}

export type JobOrderLinkClaim =
  | { kind: "no_record" }                                       // code doesn't resolve to a linkable record
  | { kind: "linked"; outcome: OwnVehicleOutcome }               // just auto-linked this turn
  | { kind: "owned_by_other" }                                   // record.psid is a different PSID
  | { kind: "owned_by_requester"; outcome: OwnVehicleOutcome }   // defensive: psid already this user

/**
 * Assesses (and, unlike `assessLinkClaim`, COMPLETES) a Messenger customer's
 * claim to a customer record via their Job Order Code.
 *
 * This intentionally breaks from `assessLinkClaim`'s "never link, always route
 * to Sales" rule: a Job Order Code is a one-time credential handed only to the
 * legitimate customer at drop-off (printed on a receipt), not a semi-public
 * value like a plate or phone number that a stranger might plausibly guess or
 * already know. Knowing the code IS the proof of ownership, so the link is
 * granted immediately with no human verification step.
 *
 * The write is a conditional `UPDATE ... WHERE psid IS NULL` so two concurrent
 * claims on the same unlinked record can't both "succeed" — the loser is
 * re-checked and reported as `owned_by_other`.
 */
export async function assessJobOrderLinkClaim(input: {
  psid: string
  code: string
}): Promise<JobOrderLinkClaim> {
  const supabase = createAdminClient()
  const code = input.code.trim().toUpperCase()
  if (!code) return { kind: "no_record" }

  const { data: job } = await supabase
    .from("job_order")
    .select("customer_record_id")
    .eq("job_order_code", code)
    .maybeSingle()

  if (!job?.customer_record_id) return { kind: "no_record" }

  // job → vehicle → the customer who owns it; the psid attaches to the customer.
  const { data: vehicle } = await supabase
    .from("customer_record")
    .select("customer_id")
    .eq("id", job.customer_record_id)
    .maybeSingle()
  if (!vehicle?.customer_id) return { kind: "no_record" }

  const { data: record } = await supabase
    .from("customer")
    .select("id, psid")
    .eq("id", vehicle.customer_id)
    .maybeSingle()

  if (!record) return { kind: "no_record" }

  if (record.psid && record.psid === input.psid) {
    return { kind: "owned_by_requester", outcome: await resolveOwnVehicleStatus(input.psid) }
  }
  if (record.psid && record.psid !== input.psid) {
    return { kind: "owned_by_other" }
  }

  const { data: updated } = await supabase
    .from("customer")
    .update({ psid: input.psid })
    .eq("id", record.id)
    .is("psid", null)
    .select("id")
    .maybeSingle()

  if (!updated) {
    // Lost a race to another claim between the read above and this write.
    const { data: recheck } = await supabase
      .from("customer")
      .select("psid")
      .eq("id", record.id)
      .maybeSingle()
    if (recheck?.psid === input.psid) {
      return { kind: "owned_by_requester", outcome: await resolveOwnVehicleStatus(input.psid) }
    }
    return { kind: "owned_by_other" }
  }

  return { kind: "linked", outcome: await resolveOwnVehicleStatus(input.psid) }
}
