import type { OutboxItem } from "@/lib/offline/db"
import { norm } from "@/lib/operations/customer-match"

export interface QueuedVehicles {
  /** customer_record ids picked from the saved-customer list. */
  recordIds: Set<string>
  /** Normalised plate numbers, from either the picker or manual entry. */
  plates: Set<string>
}

/**
 * The vehicles that already have an Add Job Order waiting in this device's
 * outbox. The server only finds out about a queued job order when it syncs,
 * so its "customer already has an active job order" guard can't stop a second
 * one being queued for the same vehicle — Add Job Order checks this instead.
 *
 * Failed items count too: they're retried on reconnect / Sync Now, so they're
 * still a booking in waiting until discarded.
 */
export function queuedVehicles(items: OutboxItem[]): QueuedVehicles {
  const recordIds = new Set<string>()
  const plates = new Set<string>()

  for (const item of items) {
    if (item.type !== "add_job_order") continue
    const payload = item.payload as {
      customer_record_id?: unknown
      plate_number?: unknown
      _display?: { plate_number?: unknown }
    }
    if (typeof payload.customer_record_id === "string" && payload.customer_record_id) {
      recordIds.add(payload.customer_record_id)
    }
    for (const raw of [payload.plate_number, payload._display?.plate_number]) {
      const plate = typeof raw === "string" ? norm(raw) : ""
      if (plate) plates.add(plate)
    }
  }

  return { recordIds, plates }
}

export function isVehicleQueued(
  queued: QueuedVehicles,
  vehicle: { id?: string | null; plate?: string | null },
): boolean {
  if (vehicle.id && queued.recordIds.has(vehicle.id)) return true
  const plate = norm(vehicle.plate)
  return plate !== "" && queued.plates.has(plate)
}
