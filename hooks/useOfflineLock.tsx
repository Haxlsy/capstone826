"use client"

import { WifiOff } from "lucide-react"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"

export const OFFLINE_ACTION_HINT = "Not available offline — reconnect to do this"

/**
 * For Operations actions that CANNOT be queued offline — i.e. everything
 * except Add Job Order and Resolve Concern. Spread `lockProps` onto the
 * action's opener (`<Button>` / `<IconButton>` / plain `<button>`): while
 * offline it's disabled with a hover hint; online it's untouched.
 *
 * Never use this on the two queueable flows (AddJobOrderForm submit,
 * ConcernDetailsDrawer resolve) — those branch to `enqueue(...)` instead.
 */
export function useOfflineLock() {
  const isOnline = useOnlineStatus()
  const lockProps = isOnline
    ? {}
    : { disabled: true, title: OFFLINE_ACTION_HINT, "aria-disabled": true as const }
  return { isOnline, lockProps }
}

/**
 * Inline caption shown once per section that has actions disabled by
 * `useOfflineLock`. The caller renders it only while offline
 * (`{!isOnline && <OfflinePausedNote />}`).
 */
export function OfflinePausedNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-xs text-status-delayed ${className}`.trim()}>
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      Paused while offline — these actions need a connection.
    </p>
  )
}
