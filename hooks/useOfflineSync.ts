"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { syncOutbox } from "@/lib/offline/sync-engine"
import * as outbox from "@/lib/offline/outbox"
import type { OutboxItem } from "@/lib/offline/db"
import { useToast } from "@/components/ui/Toast"

// Foreground-only guarantee — there is no reliable web-platform equivalent of
// a native background service for a fully closed tab (the Periodic
// Background Sync API is Chromium-only, installed-PWA-only, and heuristic
// gated). See docs/plan/operations-offline-mode-plan.md.
const SYNC_INTERVAL_MS = 5 * 60_000

export function useOfflineSync() {
  const isOnline = useOnlineStatus()
  const toast = useToast()
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [queuedItems, setQueuedItems] = useState<OutboxItem[]>([])
  const [syncing, setSyncing] = useState(false)
  const wasOnline = useRef(isOnline)

  // Read the hook's combined online state (navigator.onLine AND a real
  // /api/health ping) inside runSync without churning its useCallback identity.
  // Chrome DevTools "Network: Offline" leaves navigator.onLine === true, so we
  // must NOT trust navigator.onLine directly for sync decisions.
  const isOnlineRef = useRef(isOnline)
  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  // One read of the whole (small) outbox — the Job Order list renders the
  // queued rows, and the counts are derived from the same snapshot.
  const refreshOutbox = useCallback(async () => {
    const all = await outbox.list()
    setQueuedItems(all)
    setPendingCount(all.filter((i) => i.status === "pending").length)
    setFailedCount(all.filter((i) => i.status === "failed").length)
  }, [])

  const runSync = useCallback(
    async (opts?: { retryFailed?: boolean; silent?: boolean }) => {
      if (!isOnlineRef.current) return
      setSyncing(true)
      try {
        const result = await syncOutbox({ retryFailed: opts?.retryFailed })
        await refreshOutbox()
        if (!opts?.silent) {
          if (result.synced > 0 && result.failed === 0) {
            toast.success(`Synced ${result.synced} offline change${result.synced === 1 ? "" : "s"}.`)
          } else if (result.failed > 0) {
            toast.error("Some offline changes couldn't sync — check Settings for details.")
          }
        }
      } catch (err) {
        // syncOutbox itself threw (Dexie / unexpected) — never leave it as an
        // unhandled rejection.
        console.error("[offline] sync failed unexpectedly", err)
        await refreshOutbox().catch(() => {})
        if (!opts?.silent) toast.error("Offline sync hit an unexpected error — it'll retry.")
      } finally {
        setSyncing(false)
      }
    },
    [refreshOutbox, toast],
  )

  // On mount: load the queue and attempt a catch-up sync. Not silent — a page
  // load that finds queued items and syncs them should tell the user.
  useEffect(() => {
    refreshOutbox()
    runSync()
  }, [refreshOutbox, runSync])

  // Any component that enqueues/removes/marks an item broadcasts this — refresh
  // the queue view without waiting for the next sync tick.
  useEffect(() => {
    const onChange = () => refreshOutbox()
    window.addEventListener(outbox.OUTBOX_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(outbox.OUTBOX_CHANGED_EVENT, onChange)
  }, [refreshOutbox])

  // Reconnect — sync loudly, and retry anything that failed (including items
  // marked failed prematurely while the connection was flaky).
  useEffect(() => {
    if (isOnline && !wasOnline.current) {
      runSync({ retryFailed: true })
    }
    wasOnline.current = isOnline
  }, [isOnline, runSync])

  // 5-minute foreground backup sync (silent — background housekeeping).
  useEffect(() => {
    const interval = setInterval(() => runSync({ silent: true }), SYNC_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [runSync])

  const syncNow = useCallback(() => runSync({ retryFailed: true }), [runSync])

  return { pendingCount, failedCount, queuedItems, syncing, isOnline, syncNow }
}
