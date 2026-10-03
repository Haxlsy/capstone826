"use client"

import { ChevronUp, ChevronDown } from "lucide-react"
import { toggleSort, type AuditSortColumn, type AuditSortDir } from "@/lib/admin/audit-log-query"

/** How to phrase a direction for this column's kind of data — "newest" means
 * nothing for a text column, and "A–Z" means nothing for a timestamp. */
const DIR_LABEL: Record<"time" | "text", Record<AuditSortDir, string>> = {
  time: { asc: "oldest first", desc: "newest first" },
  text: { asc: "A–Z",          desc: "Z–A" },
}

export default function SortableTh({
  label, column, sortBy, sortDir, onSort, kind = "text",
}: {
  label: string
  column: AuditSortColumn
  sortBy: AuditSortColumn
  sortDir: AuditSortDir
  onSort: (column: AuditSortColumn) => void
  /** Phrases the hover hint as chronological ("oldest/newest first") instead of alphabetical ("A–Z"/"Z–A"). */
  kind?: "time" | "text"
}) {
  const active = sortBy === column
  const next   = toggleSort({ sortBy, sortDir }, column)
  const hint   = `Sort by ${label}: ${DIR_LABEL[kind][next.sortDir]}`

  return (
    <th className="text-left pb-2.5 pr-4 last:pr-0">
      <button
        type="button"
        onClick={() => onSort(column)}
        title={hint}
        aria-label={hint}
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted uppercase tracking-wide hover:text-body transition-colors"
      >
        {label}
        {active && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>
    </th>
  )
}
