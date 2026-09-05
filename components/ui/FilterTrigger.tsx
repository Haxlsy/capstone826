"use client"

import { SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Icon-only filter trigger, meant to be used as a `Popover` `trigger` render
 * prop so every "Filter" button across the app opens as a non-layout-shifting
 * overlay instead of an inline expanding panel. Visually identical to
 * `SearchBar`'s built-in filter icon button.
 */
export function FilterTrigger({
  active,
  count,
  open,
  onClick,
  className,
  label = "Filters",
}: {
  /** whether any filter is currently applied (drives the highlighted state) */
  active?: boolean
  /** number badge shown in the corner, e.g. count of active filters */
  count?: number
  open?: boolean
  onClick: () => void
  className?: string
  label?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border shadow-card transition-colors",
        active || open
          ? "border-primary bg-primary text-white"
          : "border-border bg-surface text-body hover:border-primary hover:bg-primary hover:text-white",
        className,
      )}
    >
      <SlidersHorizontal className="h-4 w-4" />
      {typeof count === "number" && count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-delayed px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  )
}
