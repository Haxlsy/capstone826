"use client"

import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { daysUntilDeletion, deletionDate, isExpiringSoon, EXPIRING_SOON_DAYS, type RetentionPolicy } from "@/lib/retention/plan"
import { fmtRetentionDate } from "@/lib/retention/copy"

/**
 * "Deletes after Mar 22, 2027" under an archived row. "After": an item a
 * kept job record still uses waits for that record, so this is the earliest
 * it can go. Turns red in the last EXPIRING_SOON_DAYS days.
 */
export function DeletesAfter({
  anchor, policy, className,
}: { anchor: string | null | undefined; policy: RetentionPolicy | null; className?: string }) {
  if (!anchor || !policy) return null
  const now = new Date()
  const soon = isExpiringSoon(anchor, policy, now)
  return (
    <span
      className={cn("block text-[11px] leading-tight", soon ? "text-status-delayed" : "text-muted", className)}
      title="Permanently deleted after this date unless restored"
    >
      Deletes after {fmtRetentionDate(deletionDate(anchor, policy))}
    </span>
  )
}

/**
 * "Expires in 12 days" pill on a record within EXPIRING_SOON_DAYS of its
 * automatic deletion; nothing otherwise.
 */
export function ExpiresBadge({
  anchor, policy, className,
}: { anchor: string | Date | null | undefined; policy: RetentionPolicy | null; className?: string }) {
  if (!anchor || !policy) return null
  const now = new Date()
  if (!isExpiringSoon(anchor, policy, now, EXPIRING_SOON_DAYS)) return null
  const days = Math.max(0, daysUntilDeletion(anchor, policy, now))
  const date = fmtRetentionDate(deletionDate(anchor, policy))
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-status-delayed/30 bg-status-delayed/10 px-2 py-0.5 text-[10px] font-semibold text-status-delayed",
        className,
      )}
      title={`Permanently deleted on ${date} (data retention). Export it before then if you need it.`}
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      {days <= 0 ? "Expires today" : `Expires in ${days} day${days === 1 ? "" : "s"}`}
    </span>
  )
}

/**
 * The "Expiring soon" filter chip: records within EXPIRING_SOON_DAYS of
 * automatic deletion. The weekly retention notice links to pages with it on.
 */
export function ExpiringToggle({
  active, count, onChange, className,
}: { active: boolean; count?: number | null; onChange: (next: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      aria-pressed={active}
      title={`Records permanently deleted within ${EXPIRING_SOON_DAYS} days (data retention)`}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-sm border px-3 text-sm font-medium transition-colors",
        active
          ? "border-status-delayed/40 bg-status-delayed/10 text-status-delayed"
          : "border-border bg-surface text-body hover:bg-surface-muted",
        className,
      )}
    >
      <Clock className="h-4 w-4" aria-hidden="true" />
      Expiring soon{typeof count === "number" ? ` (${count})` : ""}
    </button>
  )
}
