import { createAdminClient } from "@/lib/supabase/admin"
import { computeExpectedCompletion } from "@/lib/job-estimates"
import { fmtDateTime } from "@/lib/time-display"

export interface VehicleStatusResult {
  found: boolean
  trusted: boolean
  needsVerification: boolean
  message: string
  job?: {
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
}

export function normalizePlate(plate: string | null | undefined): string {
  return (plate ?? "").trim().toUpperCase().replace(/\s+/g, " ")
}

/**
 * Looks up the live status of a customer's vehicle against the active job
 * orders.
 *
 * - If the customer is recognized by their Messenger `psid`, they are trusted
 *   and no phone verification is needed.
 * - If the customer is not on Messenger (or psid unknown), they must provide
 *   the plate number **and** the matching contact number recorded in the
 *   customer record (identity verification, per scope).
 */
export async function lookupVehicleStatus(input: {
  plate: string
  phone?: string | null
  psid?: string | null
}): Promise<VehicleStatusResult> {
  const supabase = createAdminClient()
  const plate = normalizePlate(input.plate)
  const phone = (input.phone ?? "").trim()
  const psid = input.psid ?? null

  if (!plate) {
    return { found: false, trusted: false, needsVerification: true, message: "no plate" }
  }

  // Confirm customer from the vehicle record.
  const { data: record } = await supabase
    .from("customer_record")
    .select("id, full_name, contact_number, plate_number, psid")
    .ilike("plate_number", plate)
    .limit(1)
    .maybeSingle()

  // Trust when this is the Messenger-linked account in question.
  let trusted = false
  if (record) {
    const psidMatches = psid && record.psid && record.psid === psid
    const phoneMatches = phone && record.contact_number && record.contact_number.replace(/\s/g, "") === phone.replace(/\s/g, "")
    trusted = Boolean(psidMatches || phoneMatches)
  }

  if (!record) {
    return {
      found: false,
      trusted: false,
      needsVerification: true,
      message: "no customer record",
    }
  }

  if (!trusted) {
    return {
      found: true,
      trusted: false,
      needsVerification: true,
      message: "verification required",
    }
  }

  // Latest active job order for the customer (via customer_record or manual fields).
  const { data: job } = await supabase
    .from("job_order")
    .select(
      `id, status, scheduled_at, actual_start_at, expected_completion_at,
       service:service_id(name),
       customer:customer_record_id(full_name)`
    )
    .or(`customer_record_id.eq.${record.id},plate_number.eq.${plate}`)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!job) {
    return {
      found: true,
      trusted: true,
      needsVerification: false,
      message: "no active job",
    }
  }

  // Current stage + completion counts.
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

  const ordered = (stages ?? []).map((s: any) => {
    const rel = Array.isArray(s.service_stage) ? s.service_stage[0] : s.service_stage
    return {
      status: s.status,
      name: rel?.name ?? null,
      sequence_order: rel?.sequence_order ?? 0,
      duration_mins: (s.stage_duration_mins as number | null) ?? (rel?.stage_duration_mins ?? 0),
    }
  }).sort((a: any, b: any) => a.sequence_order - b.sequence_order)
  const total = ordered.length
  const completed = ordered.filter((s: any) => s.status === "done").length
  const active = ordered.find((s: any) => s.status !== "done")

  // Live estimate — recompute from schedule/actual + stage durations (working-hours aware)
  // instead of trusting the stored expected_completion_at column.
  const totalDurationMins = ordered.reduce((acc: number, s: any) => acc + s.duration_mins, 0)
  const { expected } = computeExpectedCompletion({
    scheduled_at: job.scheduled_at,
    actual_start_at: job.actual_start_at,
    totalDurationMins,
  })
  const expectedCompletionAt = expected ?? (job.expected_completion_at ?? null)

  return {
    found: true,
    trusted: true,
    needsVerification: false,
    message: "job found",
    job: {
      plate:          record.plate_number ?? plate,
      customerName:   (job.customer as any)?.full_name ?? null,
      serviceName:    (job.service as any)?.name ?? null,
      status:         job.status,
      currentStage:   active?.name ?? null,
      completedStages: completed,
      totalStages:     total,
      scheduledAt:     job.scheduled_at,
      expectedCompletionAt,
    },
  }
}

/**
 * Renders a lookups result into a short, neutral block of text that can be
 * injected into the Gemini prompt as authoritative context.
 */
export function formatVehicleStatus(result: VehicleStatusResult): string {
  if (!result.found) {
    return "We do not have a vehicle record matching that plate number."
  }
  if (result.needsVerification || !result.trusted) {
    return "The customer identity must be verified. Ask the customer for their plate number and the phone number linked to their booking before sharing status."
  }
  if (!result.job) {
    return "There is no active job order for this vehicle at the moment."
  }
  const j = result.job
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