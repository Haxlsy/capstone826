/**
 * Shared helpers for client-side exports: an HTML print preview (PDF via the
 * browser's print dialog) and a CSV download that opens cleanly in Excel.
 *
 * The Job Order exports have their own inline copies of this (with a smaller
 * escape and no CSV hardening); this is the safer version for new exports.
 */

// Table colours for the print export — same values as the Job Order print.
export const PRINT_BORDER = "#dddddd"
export const PRINT_HEAD_BG = "#f7f8f8"

/** Escapes text for HTML — including quotes, so it's also safe inside attributes. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * A CSV cell. Pass `{ text }` for a value Excel must keep as text — phone
 * numbers, where Excel would otherwise drop the leading zero (09171234567 →
 * 9171234567).
 */
export type CsvCell = string | number | null | undefined | { text: string | null | undefined }

const PHONE_LIKE = /^\+?[\d\s()-]+$/
// A cell starting with one of these is read by Excel/Sheets as a formula —
// a customer-controlled name like `=HYPERLINK(...)` would run when opened.
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(cell: CsvCell): string {
  if (cell !== null && typeof cell === "object") {
    const s = cell.text == null ? "" : String(cell.text)
    // `="0917…"` makes Excel show the digits verbatim. Only for values that
    // really are phone-like, so it can't be abused to smuggle a formula.
    if (s !== "" && PHONE_LIKE.test(s)) return `"=""${s}"""`
    return csvCell(s)
  }
  let s = cell == null ? "" : String(cell)
  if (FORMULA_START.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((row) => row.map((c) => csvCell(c)).join(",")).join("\r\n")
}

/** Downloads `csv` as a file. A UTF-8 BOM makes Excel read "—" and accented/Filipino names correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Opens `html` in a new tab and prints it (the user saves as PDF from the print dialog). */
export function openPrintPreview(html: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, "_blank")
  if (win) win.addEventListener("load", () => { win.print(); URL.revokeObjectURL(url) })
}
