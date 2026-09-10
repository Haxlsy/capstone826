import Dexie, { type EntityTable } from "dexie"

// Actions Operations can queue while offline — see
// docs/plan/operations-offline-mode-plan.md. Each `payload` is the exact
// JSON body the real API route already expects, so syncing is just a
// delayed call to code that already exists (lib/offline/sync-engine.ts),
// not a parallel write path.
export type OutboxActionType = "add_job_order" | "resolve_concern"

export interface OutboxItem {
  id: string // client-generated UUID; for add_job_order this doubles as the job_order.id
  type: OutboxActionType
  payload: Record<string, unknown>
  createdAt: number
  status: "pending" | "syncing" | "failed"
  errorMessage?: string
  attempts: number
}

class OfflineDB extends Dexie {
  outbox!: EntityTable<OutboxItem, "id">

  constructor() {
    super("capstone826-offline")
    this.version(1).stores({
      // createdAt indexed so the sync engine can always replay in the order
      // items were queued, not insertion/iteration order.
      outbox: "id, status, createdAt",
    })
  }
}

export const offlineDB = new OfflineDB()
