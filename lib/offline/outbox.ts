import { offlineDB, type OutboxActionType, type OutboxItem } from "@/lib/offline/db"

/**
 * Broadcast that the outbox changed so any mounted `useOfflineSync` refreshes
 * its counts + queued-item list immediately (e.g. after `AddJobOrderForm`
 * enqueues, before it redirects to the Job Order list).
 */
export const OUTBOX_CHANGED_EVENT = "offline-outbox-changed"
function notifyChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT))
}

export async function enqueue(
  type: OutboxActionType,
  payload: Record<string, unknown>,
  id: string = crypto.randomUUID(),
): Promise<OutboxItem> {
  const item: OutboxItem = {
    id,
    type,
    payload,
    createdAt: Date.now(),
    status: "pending",
    attempts: 0,
  }
  await offlineDB.outbox.put(item)
  notifyChange()
  return item
}

/** All queued items, oldest first — the order the sync engine must replay them in. */
export async function list(): Promise<OutboxItem[]> {
  return offlineDB.outbox.orderBy("createdAt").toArray()
}

/** One queued item by id, or undefined. Used to confirm a write actually persisted. */
export async function get(id: string): Promise<OutboxItem | undefined> {
  return offlineDB.outbox.get(id)
}

export async function markStatus(
  id: string,
  status: OutboxItem["status"],
  errorMessage?: string,
): Promise<void> {
  await offlineDB.outbox.update(id, { status, errorMessage })
  notifyChange()
}

export async function incrementAttempts(id: string): Promise<void> {
  const item = await offlineDB.outbox.get(id)
  if (item) await offlineDB.outbox.update(id, { attempts: item.attempts + 1 })
  notifyChange()
}

export async function remove(id: string): Promise<void> {
  await offlineDB.outbox.delete(id)
  notifyChange()
}

export async function pendingCount(): Promise<number> {
  return offlineDB.outbox.where("status").equals("pending").count()
}

export async function failedCount(): Promise<number> {
  return offlineDB.outbox.where("status").equals("failed").count()
}
