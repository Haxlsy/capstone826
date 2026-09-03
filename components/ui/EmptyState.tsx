import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  message?: React.ReactNode
  action?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card bg-surface-muted text-center",
        compact ? "px-4 py-8 gap-1.5" : "px-6 py-14 gap-2",
        className,
      )}
    >
      {Icon && (
        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="text-sm font-medium text-body">{title}</p>
      {message && <p className="text-xs text-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
