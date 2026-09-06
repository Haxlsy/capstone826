"use client"

import { useEffect } from "react"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

/**
 * Registers the service worker and subscribes this device to Web Push so the
 * technician keeps getting job/rework notifications even with the browser
 * closed. Silent no-op wherever push isn't supported (desktop browsers still
 * work fine without it — this is additive, not a requirement to use the app).
 */
export function usePushSubscription() {
  useEffect(() => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return

    let cancelled = false

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js")

        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission()
          if (permission !== "granted") return
        }
        if (Notification.permission !== "granted" || cancelled) return

        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey as string),
          })
        }
        if (cancelled) return

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        })
      } catch (err) {
        console.error("[push] subscription setup failed:", err)
      }
    }

    register()
    return () => { cancelled = true }
  }, [])
}
