import { escapeHtml, PRINT_BORDER, PRINT_HEAD_BG, type CsvCell } from "@/lib/export/print"
import { TIME_ZONE } from "@/lib/time-display"

/** The fields of a Customer Records row an export needs. `createdAt` is already display-formatted. */
export interface ExportableCustomerRecord {
  fullName: string
  contactNumber: string
  email: string | null
  plateNumber: string
  vehicleUnit: string
  psid: string | null
  createdAt: string
  activeJobOrderCode: string | null
}

export const EXPORT_HEADERS = [
  "Customer Name",
  "Contact Number",
  "Email",
  "Plate Number",
  "Vehicle",
  "Messenger Linked",
  "Active Job Order",
  "Created",
] as const

const DASH = "—"

/** One display row per vehicle record. The raw Messenger psid is deliberately NOT exported. */
export function toExportRow(r: ExportableCustomerRecord): string[] {
  return [
    r.fullName,
    r.contactNumber,
    r.email || DASH,
    r.plateNumber,
    r.vehicleUnit,
    r.psid ? "Yes" : "No",
    r.activeJobOrderCode || DASH,
    r.createdAt,
  ]
}

/** CSV cells for a row — the phone number as text so Excel keeps its leading 0. */
export function toCsvCells(r: ExportableCustomerRecord): CsvCell[] {
  const row = toExportRow(r)
  return [row[0], { text: row[1] }, ...row.slice(2)]
}

/** customer-records-YYYY-MM-DD.csv, dated in the shop's timezone. */
export function exportFilename(date: Date): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  return `customer-records-${day}.csv`
}

export function buildPrintHtml(
  records: ExportableCustomerRecord[],
  generatedAt: string,
  /** Human-readable filters in effect (search / date added), shown under the title. */
  filterNote?: string | null,
): string {
  const body = records
    .map((r) => `<tr>${toExportRow(r).map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("")
  const head = EXPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join("")
  return `<html><head><title>Customer Records</title>
      <style>body{font-family:sans-serif;font-size:12px;color:#111;margin:32px}
      .brand{font-size:18px;font-weight:700}.branch{margin-top:2px;font-size:12px;color:#555}
      .meta{margin-top:10px;font-size:11px;color:#777}hr{border:none;border-top:2px solid #111;margin:14px 0 20px}
      h2{margin:0 0 4px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid ${PRINT_BORDER};padding:6px 8px;text-align:left}th{background:${PRINT_HEAD_BG};font-weight:600}</style>
      </head><body>
      <div class="brand">826 Auto Aesthetic &amp; Protection</div>
      <div class="branch">Ortigas Extension</div>
      <hr />
      <h2>Customer Records</h2>
      ${filterNote ? `<div class="meta">Filter: ${escapeHtml(filterNote)}</div>` : ""}
      <div class="meta">Generated on ${escapeHtml(generatedAt)} · ${records.length} record${records.length !== 1 ? "s" : ""}</div>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`
}
