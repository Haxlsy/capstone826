"use client"

import { useEffect, useRef } from "react"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"

// Pages + endpoints to pre-warm into the service worker's cache while online,
// so Operations can navigate to them (and use the Add Job Order form) offline
// before ever visiting them. See public/sw.js and
// docs/plan/operations-offline-testing-guide.md.
//
// Only the pages that stay navigable offline are here — Dashboard, Job Order,
// Add Job Order, Concerns. Job Records and Technician Availability are locked
// while offline (AppSidebar), so there's no reason to pre-warm them.
const PREWARM_URLS = [
  "/dashboard/operations",
  "/dashboard/job-management",
  "/dashboard/job-management/add",
  "/dashboard/concerns",
  "/offline",
  "/api/operations/dashboard",
  "/api/operations/job-management/list-customers",
  "/api/operations/job-management/list-services",
  "/api/operations/job-management/list-technicians",
]

function prewarm() {
  for (const u of PREWARM_URLS) {
    // The document response (hard navigation / reload fallback).
    fetch(u).catch(() => {})
    // The RSC/flight payload (soft <Link> navigation) — pages only.
    if (!u.startsWith("/api/")) {
      fetch(u, { headers: { RSC: "1", "Next-Router-Prefetch": "1" } }).catch(() => {})
    }
  }
}

/**
 * Registers the offline service worker (all dashboard areas) and, for
 * Operations, pre-warms the routes/endpoints the offline flow needs — but
 * only once the SW is actually controlling this page, otherwise the
 * pre-warm fetches aren't intercepted and nothing gets cached.
 *
 * Uses useOnlineStatus() (not raw navigator.onLine) and re-runs whenever the
 * connection is confirmed, not just once at mount — a device that opens the
 * app for the first time while offline/flaky must not be permanently stuck
 * un-prewarmed for the rest of the session; the moment it's actually online,
 * this fills the cache so offline routes work from then on.
 * Renders nothing.
 */
export function ServiceWorkerRegistration({ prewarm: shouldPrewarm = false }: { prewarm?: boolean }) {
  const isOnline = useOnlineStatus()
  const warmedRef = useRef(false)

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing shouldn't break the app — offline is additive.
    })
  }, [])

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    if (!shouldPrewarm || !isOnline || warmedRef.current) return

    if (navigator.serviceWorker.controller) {
      warmedRef.current = true
      prewarm()
    } else {
      // Fresh install: wait until the new SW (skipWaiting + clients.claim)
      // takes control, then pre-warm through it.
      const onControllerChange = () => {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
        if (navigator.onLine) {
          warmedRef.current = true
          prewarm()
        }
      }
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)
      return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
  }, [shouldPrewarm, isOnline])

  return null
}
