"use client"

import { useSyncExternalStore } from "react"
import { createReachabilityStore } from "@/lib/reachability-store"

// How often to re-check while the browser's own online/offline events say
// we're online — catches "connected to wifi with no real internet," which
// navigator.onLine can't detect on its own (it only reliably reports the
// radio being off, not whether there's an actual route to the internet).
const HEARTBEAT_MS = 20_000
// A request that never answers is as good as unreachable — and would otherwise
// leave the shared heartbeat waiting on it forever.
const PING_TIMEOUT_MS = 8_000

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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
  try {
    const res = await fetch("/api/health", { cache: "no-store", signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

// ONE heartbeat per tab, shared by every useOnlineStatus() caller. This used
// to be per-hook-instance state, so a page that mounts ~6 of them fired
// /api/health ~6 times in the same millisecond every interval — see
// lib/reachability-store.ts. The env functions only touch window/document when
// called, which never happens during server rendering.
const reachability = createReachabilityStore({
  ping: pingHealth,
  isOnline: () => navigator.onLine,
  isVisible: () => document.visibilityState !== "hidden",
  onWake: (cb) => {
    const onVisible = () => {
      if (document.visibilityState === "visible") cb()
    }
    window.addEventListener("online", cb)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("online", cb)
      document.removeEventListener("visibilitychange", onVisible)
    }
  },
  intervalMs: HEARTBEAT_MS,
})

/**
 * Combines the browser's online/offline events with a periodic heartbeat
 * ping so a false-positive "online" (wifi connected, no real route out)
 * doesn't leave the app thinking it can sync when it can't.
 */
export function useOnlineStatus(): boolean {
  const navigatorOnline = useSyncExternalStore(subscribeOnline, getSnapshot, getServerSnapshot)
  const pingReachable = useSyncExternalStore(
    reachability.subscribe,
    reachability.getSnapshot,
    getServerSnapshot,
  )
  return navigatorOnline && pingReachable
}
