"use client"

import { useEffect } from "react"

// Routes + endpoints to pre-warm into the service worker's cache while online,
// so Operations can navigate to them (and use the Add Job Order form) offline.
// See public/sw.js and docs/plan/operations-offline-testing-guide.md.
const PREWARM_URLS = [
  "/dashboard/operations",
  "/dashboard/job-management",
  "/dashboard/job-management/add",
  "/dashboard/job-order-records",
  "/dashboard/technician-availability",
  "/dashboard/concerns",
  "/api/operations/dashboard",
  "/api/operations/technician-availability?status=all",
  "/api/operations/job-management/list-customers",
  "/api/operations/job-management/list-services",
  "/api/operations/job-management/list-technicians",
]

/**
 * Registers the offline service worker (all dashboard areas) and, for
 * Operations, pre-warms the routes/endpoints the offline flow needs.
 * Renders nothing.
 */
export function ServiceWorkerRegistration({ prewarm = false }: { prewarm?: boolean }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        if (prewarm && navigator.onLine) {
          // The SW's normal fetch handler caches these as a side effect.
          PREWARM_URLS.forEach((u) => {
            fetch(u).catch(() => {})
          })
        }
      })
      .catch(() => {
        // Registration failing shouldn't break the app — offline is additive.
      })
  }, [prewarm])

  return null
}
