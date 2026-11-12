/**
 * Client-side column sorting for tables, with the same click rule as the
 * Audit Trail (lib/admin/audit-log-query.ts toggleSort): a new column starts
 * ascending, clicking it again flips the direction.
 */

export type SortDir = "asc" | "desc"
export type SortKind = "text" | "time" | "number"

/** `sortBy: null` means "no column chosen yet" (the list's own default order). */
export function toggleSort<K extends string>(
  current: { sortBy: K | null; sortDir: SortDir },
  column: K,
): { sortBy: K; sortDir: SortDir } {
  if (current.sortBy !== column) return { sortBy: column, sortDir: "asc" }
  return { sortBy: column, sortDir: current.sortDir === "asc" ? "desc" : "asc" }
}

/** Placeholder values a table shows for "nothing here". */
const EMPTY_VALUES = new Set(["", "—", "unassigned"])

type SortValue = string | number | null | undefined

function isEmpty(v: SortValue): boolean {
  if (v == null) return true
  if (typeof v === "number") return Number.isNaN(v)
  return EMPTY_VALUES.has(v.trim().toLowerCase())
}

/**
 * Compares two cell values in the given direction. Empty values ("—",
 * "Unassigned", null) always go last, whichever way the column is sorted.
 * Text is case-insensitive and number-aware, so JO-0009 comes before JO-0010.
 */
export function compareValues(a: SortValue, b: SortValue, kind: SortKind, dir: SortDir): number {
  const aEmpty = isEmpty(a)
  const bEmpty = isEmpty(b)
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1

  let cmp: number
  if (kind === "number") cmp = Number(a) - Number(b)
  else if (kind === "time") cmp = new Date(String(a)).getTime() - new Date(String(b)).getTime()
  else cmp = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" })
  return dir === "asc" ? cmp : -cmp
}
