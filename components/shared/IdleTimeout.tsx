"use client"

import { Clock } from "lucide-react"
import { useIdleTimeout } from "@/hooks/useIdleTimeout"
import { useLogout } from "@/hooks/useLogout"
import { ConfirmModal } from "@/components/ui/Modal"

/**
 * Signs an unattended, still-open screen out after 20 minutes of inactivity,
 * with a 60-second warning first. Mounted next to <SessionEnforcement />
 * (same two shells — DashboardShell.tsx and app/head-technician/layout.tsx)
 * so every role gets it; correctly absent from /login and
 * /change-password-required.
 *
 * ConfirmModal's Escape/backdrop-click share the same handler as its Cancel
 * button — so either one also triggers "Log Out Now" here, same as clicking
 * it. Accepted: reusing this app's one existing confirmation-dialog
 * component is worth that minor overlap.
 */
export function IdleTimeout() {
  const { warning, remainingSeconds, stayLoggedIn } = useIdleTimeout()
  const logOutNow = useLogout({ hard: true, reason: "idle_timeout" })

  return (
    <ConfirmModal
      open={warning}
      onClose={logOutNow}
      onConfirm={stayLoggedIn}
      title="You've been inactive"
      message={`For your security, you'll be signed out in ${remainingSeconds}s due to inactivity.`}
      confirmLabel="Stay Signed In"
      cancelLabel="Log Out Now"
      icon={Clock}
    />
  )
}
