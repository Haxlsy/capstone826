import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { toggleSort, type SortDir, type SortKind } from "@/lib/table-sort"

/** How to phrase a direction for this column's kind of data, as in the Audit Trail. */
const DIR_LABEL: Record<SortKind, Record<SortDir, string>> = {
  time: { asc: "oldest first", desc: "newest first" },
  text: { asc: "A–Z", desc: "Z–A" },
  number: { asc: "lowest first", desc: "highest first" },
}

/**
 * A clickable column header for DataTable's `header`: the label, plus a chevron
 * on the column currently sorted by. Same look and hints as the Audit Trail's
 * SortableTh, without the <th> (DataTable renders that).
 */
export function SortHeader<K extends string>({
  label, column, sortBy, sortDir, onSort, kind = "text", hints,
}: {
  label: string
  column: K
  /** null = no column sorted yet. */
  sortBy: K | null
  sortDir: SortDir
  onSort: (column: K) => void
  kind?: SortKind
  /** Custom hover wording for each direction, e.g. "workflow order". */
  hints?: Record<SortDir, string>
}) {
  const active = sortBy === column
  const next = toggleSort({ sortBy, sortDir }, column)
  const hint = `Sort by ${label}: ${(hints ?? DIR_LABEL[kind])[next.sortDir]}`

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      title={hint}
      aria-label={hint}
      className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-heading transition-colors"
    >
      {label}
      {/* Inactive columns show a faint up/down icon so it's clear they can be sorted. */}
      {active
        ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
        : <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />}
    </button>
  )
}
