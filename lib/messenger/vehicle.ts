import { createAdminClient } from "@/lib/supabase/admin"
import { computeExpectedCompletion } from "@/lib/job-estimates"
import { fmtDateTime } from "@/lib/time-display"
import { ACTIVE_JOB_STATUSES } from "@/lib/messenger/booking"
import { normalizePhone, isPlausibleMobile } from "@/lib/phone"
import { DEFAULT_NOT_LINKED_MESSAGE } from "@/types/chatbot"
import { STATUS_COPY, type BotLanguage } from "@/lib/messenger/copy"

export { normalizePhone } from "@/lib/phone"
export { DEFAULT_NOT_LINKED_MESSAGE } from "@/types/chatbot"

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
   customer:customer_record_id(full_name, plate_number, contact_number)`

/** plate_number / contact_number of the customer_record a job is linked to. */
const jobCustomer = (j: JobRow): { plate_number?: string | null; contact_number?: string | null } | null =>
  (Array.isArray(j.customer) ? j.customer[0] : j.customer) ?? null

const stripPlateKey = (s: string | null | undefined): string =>
  normalizePlate(s ?? "").replace(/[^A-Z0-9]/g, "")

/**
 * Resolves the live status of every vehicle a Messenger customer has in service.
 * Identity is resolved from the psid, in priority order:
 *
 *   1. The customer_record CURRENTLY linked to the psid (Sales links this after
 *      verifying a walk-in). Its jobs = jobs under that record, under its plate,
 *      or sharing its verified phone (a 2nd car on a separate record). The psid's
 *      inquiry history is ignored — a record the psid used to be linked to must
 *      not leak.
 *   2. Otherwise, the psid's own UNHANDLED Messenger inquiries (status not yet
 *      `recorded`/`resolved`) — the grace window for a booker Sales hasn't
 *      recorded yet. A handled inquiry no longer confers identity.
 *
 * `not_linked` (→ verification ask) only when neither applies.
 */

export async function resolveOwnVehicleStatus(psid: string): Promise<OwnVehicleOutcome> {
  const supabase = createAdminClient()

  // Every identity signal this psid owns: a customer_record linked to the psid
  // (set when Sales records the inquiry) AND the plate / phone the customer gave
  // in their own Messenger inquiries. A psid with ANY of these has "booked
  // through Messenger" and must never hit the plate+phone verification wall —
  // that ask is only for a genuine stranger (no record, no inquiry).
  const [{ data: record }, { data: inquiries }] = await Promise.all([
    supabase
      .from("customer_record")
      .select("id, full_name, contact_number, plate_number, psid")
      .eq("psid", psid)
      .maybeSingle(),
    supabase
      .from("inquiry")
      .select("inquiry_type, status, extracted_plate, extracted_contact, escalated_at")
      .eq("psid", psid)
      .order("escalated_at", { ascending: false })
      .limit(5),
  ])

  const inqRows = (inquiries ?? []) as {
    inquiry_type: string | null
    status: string | null
    extracted_plate: string | null
    extracted_contact: string | null
  }[]
  // Only inquiries Sales has NOT yet processed confer identity. Once an inquiry
  // is recorded/resolved, the psid's identity is whatever customer_record it is
  // (or is not) linked to.
  const softInq = inqRows.filter((i) => i.status !== "recorded" && i.status !== "resolved")

  const plateKeys = new Set<string>()       // record + inquiry plates — strong signal
  const verifiedPhones = new Set<string>()  // the linked record's phone — strong
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

  if (record) {
    // A linked psid IS its currently-linked record. Its inquiry history — which
    // may name a record it used to be linked to — is deliberately ignored.
    recordIds.add(record.id)
    addPlate(record.plate_number)
    addPhone(verifiedPhones, record.contact_number)
  } else {
    for (const i of softInq) {
      addPlate(i.extracted_plate)
      addPhone(softPhones, i.extracted_contact)
    }
  }

  // Genuine stranger — nothing on file to identify them by → ask to verify.
  if (recordIds.size === 0 && plateKeys.size === 0 && verifiedPhones.size === 0 && softPhones.size === 0) {
    console.log("[vehicle/status]", { psid, record: Boolean(record), inquiries: inqRows.length, softInquiries: softInq.length, result: "not_linked" })
    return { kind: "not_linked" }
  }

  const bookingPlate =
    softInq.find((i) => i.extracted_plate)?.extracted_plate ?? record?.plate_number ?? null

  const { data: activeJobs } = await supabase
    .from("job_order")
    .select(JOB_SELECT)
    .eq("is_archived", false)
    .in("status", ACTIVE_JOB_STATUSES)
    .order("created_at", { ascending: false })
    .limit(200)

  const rows = (activeJobs ?? []) as unknown as JobRow[]

  // A job is the customer's when it is linked to their recorded customer_record,
  // its plate matches (its own denormalised value OR the customer_record it is
  // linked to), or it shares the record's verified phone. An inquiry-only phone
  // is a weaker signal — used only when nothing stronger matched.
  const idHit = (j: JobRow) => j.customer_record_id != null && recordIds.has(j.customer_record_id)
  const plateHit = (j: JobRow) =>
    plateKeys.has(stripPlateKey(j.plate_number)) ||
    plateKeys.has(stripPlateKey(jobCustomer(j)?.plate_number))
  const phoneIn = (set: Set<string>, j: JobRow) =>
    set.size > 0 &&
    (set.has(normalizePhone(j.contact_number)) ||
      set.has(normalizePhone(jobCustomer(j)?.contact_number)))
  const strongHit = (j: JobRow) => idHit(j) || plateHit(j) || phoneIn(verifiedPhones, j)

  let mine = rows.filter(strongHit)
  if (mine.length === 0) mine = rows.filter((j) => phoneIn(softPhones, j))
  if (mine.length > MAX_JOBS_PER_PHONE) {
    mine = rows.filter((j) => idHit(j) || plateHit(j))
  }

  console.log("[vehicle/status]", {
    psid,
    record: Boolean(record),
    inquiries: inqRows.length,
    softInquiries: softInq.length,
    plateKeys: [...plateKeys],
    verifiedPhones: [...verifiedPhones],
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
    mine.map((j) => buildJobStatus(supabase, j, record?.full_name ?? null))
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
  "Do NOT state whether any plate number or phone number has a job order — no such lookup was " +
  "performed. Explain only that their Messenger account is not yet linked to a customer record, " +
  "ask for their plate number and the phone number on their booking so our Sales team can verify " +
  "and link it, or offer to connect them with our team."

/**
 * The customer-facing account-linking ask. Sent verbatim (no Gemini) whenever an
 * unlinked psid requests vehicle status, and again on a failed attempt:
 *
 *   `unreadable`  — the reply carried no readable plate + phone pair.
 *   `unverified`  — a plate + phone were read, but we could not confirm the
 *                   customer owns them.
 *
 * `unverified` deliberately covers THREE different outcomes with ONE message: no
 * such record, a record whose phone does not match, and a record already linked
 * to a DIFFERENT Messenger account. Wording that distinguished them would be an
 * enumeration oracle — anyone could probe plate numbers and learn which ones are
 * registered purely from which reply came back. The message must therefore stay
 * silent about why verification failed, and must never confirm or deny that a
 * plate exists or belongs to somebody.
 *
 * `custom` is the admin's configured wording for the FIRST ask; blank or missing
 * falls back to the built-in default, so a cleared settings box can never send an
 * empty message. The retry variants are mechanical and stay built-in.
 *
 * It must never say a plate "has no job order": identity comes from the psid, and
 * for an unlinked account no plate or phone lookup is ever performed.
 */
export function buildLinkVerificationPrompt(opts?: {
  retry?: "unreadable" | "unverified"
  custom?: string | null
}): string {
  if (opts?.retry === "unreadable") {
    return (
      "I couldn't read a plate number and phone number in that message. " +
      "Please send them together in this format:\n\n" +
      "ABC-1234, 0917 555 0101\n\n" +
      "Use the phone number on your booking — our Sales team will verify it and link your account."
    )
  }

  if (opts?.retry === "unverified") {
    return (
      "I couldn't verify those details against your account. Please double-check your plate " +
      "number and the phone number you used when booking, then send them again like this:\n\n" +
      "ABC-1234, 0917 555 0101\n\n" +
      "If you're sure they're correct, I'll pass this to our Sales team to verify for you."
    )
  }

  return opts?.custom?.trim() || DEFAULT_NOT_LINKED_MESSAGE
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
  opts?: { focusPlate?: string; notLinkedMessage?: string | null; lang?: BotLanguage }
): string | null {
  // The admin's configured wording applies ONLY here — a linked customer's job
  // status is assembled from live data and is never affected by the setting.
  if (outcome.kind === "not_linked") {
    return buildLinkVerificationPrompt({ custom: opts?.notLinkedMessage })
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
