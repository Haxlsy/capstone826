"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const PAGE_SIZES = [10, 15, 20, 30, 50]

export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZES,
  totalLabel,
  className,
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  pageSize?: number
  onPageSizeChange?: (s: number) => void
  pageSizeOptions?: number[]
  totalLabel?: string
  className?: string
}) {
  const pages: (number | "…")[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…")
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2 text-sm text-body">
        {onPageSizeChange && pageSize != null && (
          <>
            <span>Show Results:</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-sm border border-border bg-surface px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </>
        )}
        {totalLabel && <span className="text-muted">{totalLabel}</span>}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-border text-body hover:bg-surface-muted disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "h-8 min-w-8 rounded-sm px-2 text-sm font-medium transition-colors",
                p === page
                  ? "bg-primary text-white"
                  : "border border-border text-body hover:bg-surface-muted",
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-border text-body hover:bg-surface-muted disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
