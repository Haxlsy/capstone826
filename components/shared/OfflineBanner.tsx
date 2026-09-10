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
    <div className="flex items-center justify-center gap-2 bg-status-delayed/10 px-4 py-2 text-sm font-medium text-status-delayed">
      <WifiOff className="h-4 w-4 shrink-0" />
      You&apos;re offline — changes will be saved locally and synced when you&apos;re back online.
    </div>
  )
}
