import { escapeHtml, PRINT_BORDER, PRINT_HEAD_BG, type CsvCell } from "@/lib/export/print"
import { fmtTime } from "@/hooks/audit-helpers"
import type { ApiLog } from "@/types/audit"

const ACTIVITY_HEADERS = ["Time", "User", "Role", "Action", "Target"] as const
const SECURITY_HEADERS = ["Time", "User", "Role", "Event"] as const

export function exportHeaders(showTarget: boolean): readonly string[] {
  return showTarget ? ACTIVITY_HEADERS : SECURITY_HEADERS
}

export function toExportRow(entry: ApiLog, showTarget: boolean): string[] {
  const row = [fmtTime(entry.created_at), entry.user_name, entry.role, entry.action]
  return showTarget ? [...row, entry.target || "—"] : row
}

export function toCsvCells(entry: ApiLog, showTarget: boolean): CsvCell[] {
  return toExportRow(entry, showTarget)
}

/** audit-trail-YYYY-MM-DD.csv / security-logs-YYYY-MM-DD.csv, dated in the shop's timezone. */
export function exportFilename(kind: "audit-trail" | "security-logs", date: Date): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  return `${kind}-${day}.csv`
}

export function buildPrintHtml(
  title: string,
  entries: ApiLog[],
  showTarget: boolean,
  generatedAt: string,
  filterNote?: string | null,
): string {
  const headers = exportHeaders(showTarget)
  const body = entries
    .map((e) => `<tr>${toExportRow(e, showTarget).map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("")
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")
  return `<html><head><title>${escapeHtml(title)}</title>
      <style>body{font-family:sans-serif;font-size:12px;color:#111;margin:32px}
      .brand{font-size:18px;font-weight:700}.branch{margin-top:2px;font-size:12px;color:#555}
      .meta{margin-top:10px;font-size:11px;color:#777}hr{border:none;border-top:2px solid #111;margin:14px 0 20px}
      h2{margin:0 0 4px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid ${PRINT_BORDER};padding:6px 8px;text-align:left}th{background:${PRINT_HEAD_BG};font-weight:600}</style>
      </head><body>
      <div class="brand">826 Auto Aesthetic &amp; Protection</div>
      <div class="branch">Ortigas Extension</div>
      <hr />
      <h2>${escapeHtml(title)}</h2>
      ${filterNote ? `<div class="meta">Filter: ${escapeHtml(filterNote)}</div>` : ""}
      <div class="meta">Generated on ${escapeHtml(generatedAt)} · ${entries.length} entr${entries.length !== 1 ? "ies" : "y"}</div>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`
}
