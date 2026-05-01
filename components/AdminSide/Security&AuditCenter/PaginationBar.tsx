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
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 gap-4 flex-wrap">
        <p className="text-xs text-gray-400">
          {total === 0 ? "No entries" : `Showing ${start}–${end} of ${total} entries`}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Rows per page:</span>
            <div className="flex items-center gap-1">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button key={size} type="button"
                  onClick={() => { setPageSize(size as PageSize); setPage(() => 1) }}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${pageSize === size ? "bg-gray-900 text-white" : "text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePg === 1}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <span className="text-xs text-gray-500 min-w-15 text-center">Page {safePg} of {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePg === totalPages}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }