"use client"

import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { FieldLabel } from "./Field"

/** Editable start–end time inputs. */
export function TimeRangeInputs({
  start,
  end,
  onStart,
  onEnd,
  min = "08:00",
  max = "20:00",
  className,
}: {
  start: string
  end: string
  onStart: (v: string) => void
  onEnd: (v: string) => void
  min?: string
  max?: string
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <div>
        <FieldLabel>Start</FieldLabel>
        <input
          type="time"
          value={start}
          min={min}
          max={max}
          onChange={(e) => onStart(e.target.value)}
          className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
      <div>
        <FieldLabel>End</FieldLabel>
        <input
          type="time"
          value={end}
          min={min}
          max={max}
          onChange={(e) => onEnd(e.target.value)}
          className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
    </div>
  )
}

/** Read-only "8:00 AM – 8:00 PM" display with a clock icon. */
export function TimeRangeLabel({
  start,
  end,
  className,
}: {
  start: string
  end: string
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-body", className)}>
      <Clock className="h-3 w-3" />
      {start} – {end}
    </span>
  )
}
