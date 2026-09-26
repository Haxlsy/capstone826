import type { createAdminClient } from "@/lib/supabase/admin"
import { ACTIVE_JOB_STATUSES } from "@/lib/job-delay"

/**
 * Locks and delete rules for the Customer / vehicle split.
 *
 *   customer          the person: name, phone, email, Messenger account
 *   customer_record   one of their vehicles: plate, vehicle unit
 *
 * Job pages read the live customer/vehicle over the job's own snapshot, so
 * changing what an in-service job displays is restricted:
 *   - the customer's NAME is locked while ANY of their vehicles is in service
 *     (phone and email can always be corrected);
 *   - a vehicle's plate / unit is locked while THAT vehicle is in service;
 *   - a vehicle or a customer can't be deleted while it (or, for a customer,
 *     any of their vehicles) is in service.
 */
export const CUSTOMER_LOCKED_FIELDS = ["full_name"] as const
export const VEHICLE_LOCKED_FIELDS = ["plate_number", "vehicle_unit"] as const

export function nameLockedMessage(jobOrderCode: string): string {
  return `Linked to active job order ${jobOrderCode} — the name can't be changed while a vehicle is in service.`
}

export function vehicleLockedMessage(jobOrderCode: string): string {
  return `Linked to active job order ${jobOrderCode} — edit is disabled while it's in service.`
}

export function deleteVehicleBlockedMessage(jobOrderCode: string): string {
  return `Linked to active job order ${jobOrderCode} — it can't be deleted while it's in service.`
}

export function deleteCustomerBlockedMessage(jobOrderCode: string): string {
  return `A vehicle is in service (job order ${jobOrderCode}) — the customer can't be deleted until it is released.`
}

/**
 * Pure reducer: given job_order rows (customer_record_id, job_order_code,
 * status), which vehicle ids are in service and by which job order code. A
 * vehicle realistically has at most one active job at a time; if more than one
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

/** Bulk lookup for a page of vehicle ids — one query, not N+1. */
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

/** Vehicle id → active job code for every vehicle a customer owns. */
export async function findActiveJobsByCustomer(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
): Promise<Map<string, string>> {
  const { data: vehicles } = await admin.from("customer_record").select("id").eq("customer_id", customerId)
  return findActiveJobsByCustomerRecord(admin, (vehicles ?? []).map((v) => v.id as string))
}

/** Any one active job code from a vehicle-id → code map, or null. */
export function anyActiveCode(map: Map<string, string>): string | null {
  return map.values().next().value ?? null
}

/** Confirmation text for deleting ONE vehicle. The customer and their Messenger link are untouched. */
export function deleteVehicleConfirmMessage(v: { plateNumber: string; vehicleUnit: string | null }): string {
  const what = v.vehicleUnit ? `${v.plateNumber} (${v.vehicleUnit})` : v.plateNumber
  return `This permanently removes the vehicle ${what}. The customer and their other vehicles stay. Past job orders keep their details. This can't be undone.`
}

/** Confirmation text for deleting a whole customer and all their vehicles. */
export function deleteCustomerConfirmMessage(c: {
  fullName: string
  vehicleCount: number
  psid: string | null
}): string {
  const cars = c.vehicleCount === 1 ? "their 1 vehicle" : `all ${c.vehicleCount} of their vehicles`
  const link = c.psid ? " Their linked Messenger account will be unlinked and they'll need to verify again." : ""
  return `This permanently removes ${c.fullName} and ${cars}. Past job orders keep their details.${link} This can't be undone.`
}
