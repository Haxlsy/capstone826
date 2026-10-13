import * as React from "react"
import { cn } from "@/lib/utils"
import { statusStyle } from "@/lib/ui/status"
import { jobStatusBadges } from "@/lib/job-delay"

/** Generic pill. */
export function Badge({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/** Status pill driven by lib/ui/status. Pass a raw label or db key. */
export function StatusBadge({
  status,
  label,
  withDot = false,
  className,
}: {
  status: string | null | undefined
  /** override the display text (defaults to the canonical label) */
  label?: string
  withDot?: boolean
  className?: string
}) {
  const s = statusStyle(status)
  return (
    <Badge className={cn(s.soft, className)}>
      {withDot && <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />}
      {label ?? s.label}
    </Badge>
  )
}

/**
 * A job order's status pill, plus a "Delayed" pill beside it when the job is
 * running late (see jobStatusBadges). `className` styles each pill;
 * `stacked` puts them one above the other for narrow rows.
 */
export function JobStatusBadges({
  status,
  isOverdue,
  stacked = false,
  className,
}: {
  status: string
  isOverdue: boolean
  stacked?: boolean
  className?: string
}) {
  return (
    <span className={cn("inline-flex shrink-0 gap-1.5", stacked ? "flex-col items-end" : "items-center")}>
      {jobStatusBadges(status, isOverdue).map((b) => (
        <StatusBadge key={b} status={b} className={className} />
      ))}
    </span>
  )
}
