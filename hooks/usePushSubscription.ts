"use client"

import { useEffect } from "react"
import { subscribeToPush } from "@/lib/push/client"
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport"

/**
 * Registers the service worker and subscribes this device to Web Push so the
 * technician keeps getting job/rework notifications even with the browser
 * closed. Silent no-op wherever push isn't supported or the permission
 * prompt is declined — this is additive, not a requirement to use the app.
 * See lib/push/client.ts for the shared subscribe logic, also used by the
 * manual "Enable Notifications" control in Settings
 * (components/head-technician/PushNotificationSettings.tsx).
 *
 * Mobile-only by design (not a technical limitation — desktop browsers
 * support the Push API too): field technicians use their phones for job
 * alerts, so a desktop/tablet session shouldn't silently register for push.
 * Matches the same restriction shown in Settings.
 */
export function usePushSubscription() {
  const isMobile = useIsMobileViewport()

  useEffect(() => {
    if (isMobile) subscribeToPush()
  }, [isMobile])
}
