import { Clock } from "lucide-react"

/**
 * Shown at the top of the head-technician portal for a technician made
 * Temporary Head by Operations, so they know the login is for today only.
 * Their access is switched off automatically at 11:59 PM Manila time
 * (lib/auth/temporary-access.ts).
 */
export function TemporaryAccessBanner() {
  return (
    <div className="flex items-start gap-2 border-b border-status-warning/30 bg-status-warning/10 px-4 py-2.5 text-xs text-status-warning">
      <Clock className="mt-px h-3.5 w-3.5 shrink-0" />
      <p>
        <span className="font-semibold">You&apos;re a Temporary Head Technician today.</span>{" "}
        Your access ends at 11:59 PM.
      </p>
    </div>
  )
}
