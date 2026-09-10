"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

// How often to re-check while the browser's own online/offline events say
// we're online — catches "connected to wifi with no real internet," which
// navigator.onLine can't detect on its own (it only reliably reports the
// radio being off, not whether there's an actual route to the internet).
const HEARTBEAT_MS = 20_000

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

const getSnapshot = () => navigator.onLine

// The server has no network state — assume online, which is what every page
// is server-rendered (and service-worker-cached) as. useSyncExternalStore
// swaps to the real client value right after hydration *without* a mismatch
// error, unlike useState(navigator.onLine) + useEffect. This matters because
// this hook drives conditionally-rendered UI (OfflineBanner, the sidebar nav
// lock) on pages that are served straight from the SW cache while offline.
const getServerSnapshot = () => true

async function pingHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Combines the browser's online/offline events with a periodic heartbeat
 * ping so a false-positive "online" (wifi connected, no real route out)
 * doesn't leave the app thinking it can sync when it can't.
 */
export function useOnlineStatus(): boolean {
  const navigatorOnline = useSyncExternalStore(subscribeOnline, getSnapshot, getServerSnapshot)

  // Heartbeat refinement — only meaningful while the browser thinks it's
  // online. Held separately so it never affects the hydration-safe snapshot
  // above; setState only happens in async callbacks, never in the effect body.
  const [pingReachable, setPingReachable] = useState(true)

  useEffect(() => {
    if (!navigatorOnline) return
    let cancelled = false
    const run = () => {
      pingHealth().then((ok) => {
        if (!cancelled) setPingReachable(ok)
      })
    }
    run()
    const interval = setInterval(run, HEARTBEAT_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [navigatorOnline])

  return navigatorOnline && pingReachable
}
