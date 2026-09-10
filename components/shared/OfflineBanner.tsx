"use client"

import { WifiOff } from "lucide-react"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"

/**
 * Persistent banner while offline. The "back online, syncing…" toast lives in
 * useOfflineSync instead of here, since that hook is the one that actually
 * knows the pending count — this component only owns the "you're offline"
 * half of the messaging.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-status-delayed/10 px-4 py-2 text-center text-sm font-medium text-status-delayed">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        <strong className="font-semibold">You&apos;re offline.</strong> You can still create a job
        order and resolve a concern — they&apos;ll sync automatically when you reconnect. Other
        actions are paused.
      </span>
    </div>
  )
}
