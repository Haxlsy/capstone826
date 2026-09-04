"use client"

import { cn } from "@/lib/utils"

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

/**
 * S M T W T F S day selector. `readOnly` renders the same pills without
 * interaction (used in the technician list rows).
 */
export function DayPillSelector({
  value,
  onChange,
  readOnly,
  className,
}: {
  value: string[]
  onChange?: (next: string[]) => void
  readOnly?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex gap-1", className)}>
      {WEEK_DAYS.map((d) => {
        const active = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            disabled={readOnly}
            onClick={
              onChange
                ? () => onChange(active ? value.filter((x) => x !== d) : [...value, d])
                : undefined
            }
            className={cn(
              "flex items-center justify-center rounded-sm text-xs font-semibold transition-colors",
              readOnly ? "h-6 w-6" : "h-9 w-9",
              active
                ? "bg-primary text-white"
                : "bg-surface-muted text-muted",
              !readOnly && !active && "hover:bg-border/60",
              readOnly && "cursor-default",
            )}
          >
            {d[0]}
          </button>
        )
      })}
    </div>
  )
}
