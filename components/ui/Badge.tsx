import * as React from "react"
import { cn } from "@/lib/utils"
import { statusStyle } from "@/lib/ui/status"

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
