import { offlineDB } from "@/lib/offline/db"
import type { OutboxItem } from "@/lib/offline/db"
import * as outbox from "@/lib/offline/outbox"

export interface SyncResult {
  synced: number
  failed: number
  /** Items left in the queue after this run (still pending, or newly failed). */
  remaining: number
}

async function replayItem(item: OutboxItem): Promise<void> {
  switch (item.type) {
    case "add_job_order": {
      // `_display` is a UI-only snapshot (customer/service/tech names) the Job
      // Order list uses to render the queued row — never send it to the API.
      const body = { ...item.payload }
      delete body._display
      const res = await fetch("/api/operations/job-management/add-job-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? `Failed to sync job order (${res.status}).`)
      }
      return
    }
    case "resolve_concern": {
      const { concernId, ...body } = item.payload as { concernId: string; [key: string]: unknown }
      const res = await fetch(`/api/operations/job-concerns/${concernId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? `Failed to sync concern resolution (${res.status}).`)
      }
      return
    }
  }
}

/**
 * Replays queued items in the order they were created, stopping at the
 * first failure instead of skipping ahead — a later item may implicitly
 * depend on an earlier one having actually reached the server (e.g. two
 * job orders queued for the same customer while offline: the second one
 * should only be evaluated against the guard after the first has landed).
 *
 * `retryFailed`: reset previously-failed items back to pending first — this
 * is what the manual "Sync Now" action does, since a failure may have been
 * caused by a condition that's since changed (e.g. the conflicting job order
 * was completed).
 */
export async function syncOutbox({ retryFailed = false }: { retryFailed?: boolean } = {}): Promise<SyncResult> {
  if (retryFailed) {
    const failed = await offlineDB.outbox.where("status").equals("failed").toArray()
    await Promise.all(failed.map((item) => outbox.markStatus(item.id, "pending")))
  }

  const pending = await offlineDB.outbox.where("status").equals("pending").sortBy("createdAt")

  let synced = 0
  let failed = 0

  for (const item of pending) {
    await outbox.markStatus(item.id, "syncing")
    try {
      await replayItem(item)
      await outbox.remove(item.id)
      synced += 1
    } catch (err) {
      await outbox.incrementAttempts(item.id)
      await outbox.markStatus(item.id, "failed", err instanceof Error ? err.message : String(err))
      failed += 1
      break // stop — don't attempt items queued after this one yet
    }
  }

  const remaining = await offlineDB.outbox.count()
  return { synced, failed, remaining }
}
