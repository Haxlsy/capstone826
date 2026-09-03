"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  size = "md",
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label?: string
  size?: "sm" | "md"
  className?: string
}) {
  const dims =
    size === "sm"
      ? { track: "h-5 w-9", knob: "h-3.5 w-3.5", travel: "translate-x-4" }
      : { track: "h-6 w-11", knob: "h-5 w-5", travel: "translate-x-5" }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-pill p-0.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        dims.track,
        checked ? "bg-status-inspection" : "bg-border",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow-sm transition-transform",
          dims.knob,
          checked ? dims.travel : "translate-x-0",
        )}
      />
    </button>
  )
}
