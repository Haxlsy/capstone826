"use client"

import { useEffect } from "react"
import { subscribeToPush } from "@/lib/push/client"

/**
 * Registers the service worker and subscribes this device to Web Push so the
 * technician keeps getting job/rework notifications even with the browser
 * closed. Silent no-op wherever push isn't supported or the permission
 * prompt is declined — this is additive, not a requirement to use the app.
 * See lib/push/client.ts for the shared subscribe logic, also used by the
 * manual "Enable Notifications" control in Settings
 * (components/head-technician/PushNotificationSettings.tsx).
 */
export function usePushSubscription() {
  useEffect(() => {
    subscribeToPush()
  }, [])
}
