"use client"

import { useEffect, useState } from "react"

// How often to re-check while the browser's own online/offline events say
// we're offline — catches "connected to wifi with no real internet," which
// navigator.onLine can't detect on its own (it only reliably reports the
// radio being off, not whether there's an actual route to the internet).
const HEARTBEAT_MS = 20_000

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
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  )

  useEffect(() => {
    function handleOnline() {
      // Browser says the radio is back — confirm there's an actual route
      // out before believing it.
      pingHealth().then(setIsOnline)
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    const interval = setInterval(() => {
      if (!navigator.onLine) {
        setIsOnline(false)
        return
      }
      pingHealth().then(setIsOnline)
    }, HEARTBEAT_MS)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval)
    }
  }, [])

  return isOnline
}
