"use client"

import { useCallback, useSyncExternalStore } from "react"

/** Phone width: below Tailwind's `md` (768px). */
export const MOBILE_QUERY = "(max-width: 767px)"
/** Tablet width: Tailwind `md` up to (not including) `lg` (1024px). */
export const TABLET_QUERY = "(min-width: 768px) and (max-width: 1023px)"

// No viewport on the server — `null` lets callers keep the desktop layout
// until hydration instead of guessing and risking a hydration mismatch.
function getServerSnapshot(): boolean | null {
  return null
}

/**
 * Whether a CSS media query currently matches. Same `useSyncExternalStore`
 * pattern as `useIsMobileViewport`, generalised to any query, so it reads
 * matchMedia during render and stays hydration-safe.
 */
export function useMediaQuery(query: string): boolean | null {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", callback)
      return () => mql.removeEventListener("change", callback)
    },
    [query],
  )
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
