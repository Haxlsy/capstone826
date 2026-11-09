/**
 * One page of an already-loaded list, with the page number clamped into range
 * (a live list can shrink between refreshes, e.g. delayed jobs that get back on
 * track, and must never land on an empty page). `from`/`to` are 1-based for a
 * "Showing 1–8 of 24" label; both are 0 for an empty list.
 */
export function pageSlice<T>(items: readonly T[], page: number, pageSize: number): {
  rows: T[]
  page: number
  totalPages: number
  from: number
  to: number
} {
  const size = Math.max(1, Math.floor(pageSize))
  const totalPages = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)
  const start = (current - 1) * size
  const rows = items.slice(start, start + size)
  return {
    rows,
    page: current,
    totalPages,
    from: rows.length === 0 ? 0 : start + 1,
    to: start + rows.length,
  }
}
