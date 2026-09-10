"use client"

import { useEffect } from "react"

// Pages + endpoints to pre-warm into the service worker's cache while online,
// so Operations can navigate to them (and use the Add Job Order form) offline
// before ever visiting them. See public/sw.js and
// docs/plan/operations-offline-testing-guide.md.
const PREWARM_URLS = [
  "/dashboard/operations",
  "/dashboard/job-management",
  "/dashboard/job-management/add",
  "/dashboard/job-order-records",
  "/dashboard/technician-availability",
  "/dashboard/concerns",
  "/offline",
  "/api/operations/dashboard",
  "/api/operations/technician-availability?status=all",
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
 * Renders nothing.
 */
export function ServiceWorkerRegistration({ prewarm: shouldPrewarm = false }: { prewarm?: boolean }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing shouldn't break the app — offline is additive.
    })

    if (!shouldPrewarm || !navigator.onLine) return

    if (navigator.serviceWorker.controller) {
      prewarm()
    } else {
      // Fresh install: wait until the new SW (skipWaiting + clients.claim)
      // takes control, then pre-warm through it.
      const onControllerChange = () => {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
        if (navigator.onLine) prewarm()
      }
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)
      return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
  }, [shouldPrewarm])

  return null
}
