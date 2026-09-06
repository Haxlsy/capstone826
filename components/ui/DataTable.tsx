"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface Column<Row> {
  key: string
  header: React.ReactNode
  /** cell renderer */
  cell: (row: Row) => React.ReactNode
  className?: string
  headerClassName?: string
  align?: "left" | "center" | "right"
}

/**
 * Presentational table shell — gray uppercase header, muted empty-state block,
 * optional footer. Pages keep their own fetch / filter / sort / pagination
 * logic; this only renders.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  error,
  emptyLabel = "No records found.",
  footer,
  className,
}: {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row, index: number) => string
  onRowClick?: (row: Row) => void
  loading?: boolean
  error?: string | null
  emptyLabel?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  const align = (a?: "left" | "center" | "right") =>
    a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left"

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-subtle">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-body",
                    align(c.align),
                    c.headerClassName,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted">
                  Loading…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-status-delayed">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-3">
                  <div className="rounded-sm bg-surface-muted px-4 py-10 text-center text-sm text-body">
                    {emptyLabel}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-border-subtle last:border-0 transition-colors",
                    onRowClick && "group cursor-pointer hover:bg-primary-soft/40",
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3", align(c.align), c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}
