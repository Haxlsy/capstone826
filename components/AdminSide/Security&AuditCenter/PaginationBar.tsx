"use client"

import {ChevronLeft, ChevronRight} from "lucide-react"

const PAGE_SIZE_OPTIONS = [10, 15, 20, 100] as const
type PageSize = typeof PAGE_SIZE_OPTIONS[number]

export default function PaginationBar({
    total, pageSize, setPageSize, page, setPage,
  }: {
    total: number; pageSize: PageSize; setPageSize: (s: PageSize) => void
    page: number; setPage: (fn: (p: number) => number) => void
  }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePg     = Math.min(page, totalPages)
    const start      = total === 0 ? 0 : (safePg - 1) * pageSize + 1
    const end        = Math.min((safePg - 1) * pageSize + pageSize, total)
    return (
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-subtle gap-4 flex-wrap">
        <p className="text-xs text-muted">
          {total === 0 ? "No entries" : `Showing ${start}–${end} of ${total} entries`}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted">Rows per page:</span>
            <div className="flex items-center gap-1">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button key={size} type="button"
                  onClick={() => { setPageSize(size as PageSize); setPage(() => 1) }}
                  className={`text-xs font-medium px-2.5 py-1 rounded-sm transition-colors ${pageSize === size ? "bg-primary text-white" : "text-body border border-border hover:bg-surface-muted"}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePg === 1}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-sm border border-border text-body hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <span className="text-xs text-body min-w-15 text-center">Page {safePg} of {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePg === totalPages}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-sm border border-border text-body hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }