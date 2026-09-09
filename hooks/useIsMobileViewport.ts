"use client"

import { useSyncExternalStore } from "react"

const MOBILE_QUERY = "(max-width: 767px)"

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches
}

// No viewport on the server — `null` lets callers render a neutral
// "checking" state instead of guessing and risking a hydration mismatch.
function getServerSnapshot(): boolean | null {
  return null
}

/**
 * Whether the viewport is mobile-width (below Tailwind's `md` breakpoint).
 * `useSyncExternalStore` (rather than useState+useEffect) is what React
 * recommends for subscribing to an external source like matchMedia — it
 * reads the current value directly during render instead of setting state
 * from inside an effect body, and it's hydration-safe via getServerSnapshot.
 */
export function useIsMobileViewport(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
