import { offlineDB, type OutboxActionType, type OutboxItem } from "@/lib/offline/db"

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
  return item
}

/** All queued items, oldest first — the order the sync engine must replay them in. */
export async function list(): Promise<OutboxItem[]> {
  return offlineDB.outbox.orderBy("createdAt").toArray()
}

export async function markStatus(
  id: string,
  status: OutboxItem["status"],
  errorMessage?: string,
): Promise<void> {
  await offlineDB.outbox.update(id, { status, errorMessage })
}

export async function incrementAttempts(id: string): Promise<void> {
  const item = await offlineDB.outbox.get(id)
  if (item) await offlineDB.outbox.update(id, { attempts: item.attempts + 1 })
}

export async function remove(id: string): Promise<void> {
  await offlineDB.outbox.delete(id)
}

export async function pendingCount(): Promise<number> {
  return offlineDB.outbox.where("status").equals("pending").count()
}

export async function failedCount(): Promise<number> {
  return offlineDB.outbox.where("status").equals("failed").count()
}
