"use client"

import * as React from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SearchBarProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string
  onChange: (value: string) => void
  /** show a detached trailing filter-icon button */
  onFilterClick?: () => void
  filterActive?: boolean
  filterCount?: number
  containerClassName?: string
}

export function SearchBar({
  value,
  onChange,
  onFilterClick,
  filterActive,
  filterCount,
  placeholder = "Search…",
  containerClassName,
  className,
  ...props
}: SearchBarProps) {
  return (
    <div className={cn("flex items-center gap-2.5", containerClassName)}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-11 w-full rounded-pill border border-border bg-surface pl-10 pr-9 text-sm text-heading shadow-card",
            "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            className,
          )}
          {...props}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {onFilterClick && (
        <button
          type="button"
          aria-label="Filters"
          aria-pressed={filterActive}
          onClick={onFilterClick}
          className={cn(
            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border shadow-card transition-colors",
            filterActive
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-body hover:text-heading",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {typeof filterCount === "number" && filterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-delayed px-1 text-[10px] font-bold text-white">
              {filterCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
