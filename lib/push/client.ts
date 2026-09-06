"use client"

// Shared client-side Web Push helpers — one source of truth for the subscribe
// flow, used both by the silent auto-subscribe hook (hooks/usePushSubscription.ts,
// mounted once in the technician layout) and the manual controls in Settings
// (components/head-technician/PushNotificationSettings.tsx).

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export interface PushStatus {
  supported: boolean
  permission: NotificationPermission | "unsupported"
  subscribed: boolean
}

/** Read-only status check — never prompts for permission, safe to call on every Settings visit. */
export async function getPushStatus(): Promise<PushStatus> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return { supported: false, permission: "unsupported", subscribed: false }
  }

  const permission = Notification.permission
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js")
    const subscription = await registration?.pushManager.getSubscription()
    return { supported: true, permission, subscribed: !!subscription }
  } catch {
    return { supported: true, permission, subscribed: false }
  }
}

export interface SubscribeResult {
  ok: boolean
  permission: NotificationPermission | "unsupported"
  error?: string
}

/** Registers the service worker, requests permission if needed, subscribes, and posts the subscription to the server. */
export async function subscribeToPush(): Promise<SubscribeResult> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return { ok: false, permission: "unsupported", error: "Push notifications are not configured." }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, permission: "unsupported", error: "This browser doesn't support push notifications." }
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js")

    if (Notification.permission === "default") {
      await Notification.requestPermission()
    }
    if (Notification.permission !== "granted") {
      return { ok: false, permission: Notification.permission }
    }

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey as string),
      })
    }

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    })

    return { ok: true, permission: "granted" }
  } catch (err) {
    console.error("[push] subscription setup failed:", err)
    return { ok: false, permission: Notification.permission, error: "Something went wrong enabling notifications." }
  }
}
