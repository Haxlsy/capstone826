export function exportToCSV(
  rows: Record<string, unknown>[],
  filename: string
) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportToPDF() {
  window.print()
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatJobId(id: number) {
  return `JO-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`
}
