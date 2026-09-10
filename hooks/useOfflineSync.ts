"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { syncOutbox } from "@/lib/offline/sync-engine"
import * as outbox from "@/lib/offline/outbox"
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
  const [syncing, setSyncing] = useState(false)
  const wasOnline = useRef(isOnline)

  const refreshCounts = useCallback(async () => {
    setPendingCount(await outbox.pendingCount())
    setFailedCount(await outbox.failedCount())
  }, [])

  const runSync = useCallback(
    async (opts?: { retryFailed?: boolean; silent?: boolean }) => {
      if (!navigator.onLine) return
      setSyncing(true)
      try {
        const result = await syncOutbox({ retryFailed: opts?.retryFailed })
        await refreshCounts()
        if (!opts?.silent) {
          if (result.synced > 0 && result.failed === 0) {
            toast.success(`Synced ${result.synced} offline change${result.synced === 1 ? "" : "s"}.`)
          } else if (result.failed > 0) {
            toast.error("Some offline changes couldn't sync — check Settings for details.")
          }
        }
      } finally {
        setSyncing(false)
      }
    },
    [refreshCounts, toast],
  )

  // Pick up counts and attempt a silent catch-up sync on mount (covers a
  // page refresh with items still queued from before).
  useEffect(() => {
    refreshCounts()
    runSync({ silent: true })
  }, [refreshCounts, runSync])

  // Reconnect — sync loudly so the user sees the outcome.
  useEffect(() => {
    if (isOnline && !wasOnline.current) {
      runSync()
    }
    wasOnline.current = isOnline
  }, [isOnline, runSync])

  // 5-minute foreground backup sync.
  useEffect(() => {
    const interval = setInterval(() => runSync({ silent: true }), SYNC_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [runSync])

  const syncNow = useCallback(() => runSync({ retryFailed: true }), [runSync])

  return { pendingCount, failedCount, syncing, isOnline, syncNow }
}
