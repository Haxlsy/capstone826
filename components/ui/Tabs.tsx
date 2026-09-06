"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface TabItem {
  key: string
  label: React.ReactNode
  count?: number
}

/**
 * Horizontal tabs. `variant="underline"` = teal underline (default, page-level).
 * `variant="pill"` = filled pill (All/Pending/Resolved style filters).
 */
export function Tabs({
  items,
  value,
  onChange,
  variant = "underline",
  className,
}: {
  items: TabItem[]
  value: string
  onChange: (key: string) => void
  variant?: "underline" | "pill"
  className?: string
}) {
  if (variant === "pill") {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {items.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "rounded-pill px-3 py-1.5 text-sm font-medium transition-colors",
              value === t.key
                ? "bg-primary text-white"
                : "bg-surface-muted text-body hover:text-heading",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="ml-1.5 text-xs opacity-70">{t.count}</span>
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border-subtle", className)}>
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            "relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
            value === t.key
              ? "text-primary"
              : "text-body hover:text-heading",
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span
              className={cn(
                "ml-1.5 rounded-pill px-1.5 py-0.5 text-[11px] font-semibold",
                value === t.key ? "bg-primary/12 text-primary" : "bg-surface-muted text-muted",
              )}
            >
              {t.count}
            </span>
          )}
          {value === t.key && (
            <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  )
}
