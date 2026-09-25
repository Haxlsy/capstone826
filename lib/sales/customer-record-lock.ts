import type { createAdminClient } from "@/lib/supabase/admin"
import { ACTIVE_JOB_STATUSES } from "@/lib/job-delay"

/** One wording shared by the API's 409 and the UI's disabled-Edit tooltip. */
export function lockedEditMessage(jobOrderCode: string): string {
  return `Linked to active job order ${jobOrderCode} — edit is disabled while it's in service.`
}

/** Fields whose value a linked job order actually displays (see
 *  lib/operations/job-detail-data.ts, which prefers the live customer_record
 *  over the job's own snapshot). Editing any of these on a customer_record
 *  that's linked to an active job changes what that job shows. `psid` isn't
 *  one of them — linking/relinking Messenger doesn't feed a job's display. */
export const CUSTOMER_RECORD_LOCKED_FIELDS = [
  "full_name",
  "contact_number",
  "email",
  "plate_number",
  "vehicle_unit",
] as const

/**
 * Pure reducer: given job_order rows (customer_record_id, job_order_code,
 * status), which record ids are locked and by which job order code. A record
 * realistically has at most one active job at a time; if more than one
 * somehow exists, the first one found wins.
 */
export function pickActiveJobCodes(
  jobs: { customer_record_id: string | null; job_order_code: string; status: string }[],
): Map<string, string> {
  const locked = new Map<string, string>()
  for (const j of jobs) {
    if (!j.customer_record_id) continue
    if (!(ACTIVE_JOB_STATUSES as readonly string[]).includes(j.status)) continue
    if (!locked.has(j.customer_record_id)) locked.set(j.customer_record_id, j.job_order_code)
  }
  return locked
}

/** Bulk lookup for a page of customer_record ids — one query, not N+1. */
export async function findActiveJobsByCustomerRecord(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data } = await admin
    .from("job_order")
    .select("customer_record_id, job_order_code, status")
    .in("customer_record_id", ids)
    .in("status", ACTIVE_JOB_STATUSES as unknown as string[])
  return pickActiveJobCodes((data ?? []) as { customer_record_id: string | null; job_order_code: string; status: string }[])
}

/** Wording for the API's 409 and the UI's disabled-Delete tooltip. */
export function deleteBlockedMessage(jobOrderCode: string): string {
  return `Linked to active job order ${jobOrderCode} — it can't be deleted while it's in service.`
}

/** A customer record can be deleted unless a job order for it is still active. */
export function canDeleteCustomerRecord(
  activeJobCode: string | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  return activeJobCode ? { ok: false, reason: deleteBlockedMessage(activeJobCode) } : { ok: true }
}

/**
 * Confirmation text for deleting a customer record. Past job orders keep their
 * own copy of the customer's details, so history survives; a linked Messenger
 * account is dropped and the customer re-verifies next time.
 */
export function deleteConfirmMessage(r: { fullName: string; plateNumber: string; psid: string | null }): string {
  const base = `This permanently removes ${r.fullName} — ${r.plateNumber}. Past job orders keep their details.`
  const link = r.psid ? " Their linked Messenger account will be unlinked and they'll need to verify again." : ""
  return `${base}${link} This can't be undone.`
}
