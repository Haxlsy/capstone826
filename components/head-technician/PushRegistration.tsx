"use client"

import { usePushSubscription } from "@/hooks/usePushSubscription"

/** Registers the technician's device for Web Push. Renders nothing. */
export function PushRegistration() {
  usePushSubscription()
  return null
}
