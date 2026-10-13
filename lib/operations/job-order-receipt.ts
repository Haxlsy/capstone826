import ExcelJS from "exceljs"
import { escapeHtml, PRINT_BORDER, PRINT_HEAD_BG } from "@/lib/export/print"
import { fmtDateTime } from "@/lib/time-display"
import type { ExportJobDetail } from "@/lib/operations/job-order-export"

/**
 * The customer's copy of a job order: what Operations hands over (printed or
 * saved as PDF) at drop-off. Its job is to give the customer their Job Order
 * ID, which the Messenger assistant asks for when their account isn't linked
 * yet. Deliberately short: no stages, photos or status history. Those belong
 * to the full record in job-order-export.ts, exported once the job is Released.
 *
 * Pure: no DB, no network.
 */

const SHOP_NAME = "826 Auto Aesthetic & Protection"
const SHOP_BRANCH = "Ortigas Extension"
const TO_BE_CONFIRMED = "To be confirmed"

const STATUS_STEPS = [
  "Message our Facebook Page on Messenger.",
  "Tap Vehicle Status.",
  "If asked, send the Job Order ID shown on this receipt.",
]
const KEEP_NOTE = "Please keep this receipt. You will need your Job Order ID to check on your vehicle."

/** Only technicians actually assigned are listed, so a detailing-only job has no empty "Head Installer" row. */
function receiptFields(job: ExportJobDetail): { label: string; value: string }[] {
  const when = (iso: string | null) => (iso ? fmtDateTime(iso) : TO_BE_CONFIRMED)
  const fields = [
    { label: "Customer", value: job.customer_name },
    { label: "Contact Number", value: job.contact_number },
    ...(job.email ? [{ label: "Email", value: job.email }] : []),
    { label: "Vehicle", value: job.vehicle_unit },
    { label: "Plate Number", value: job.plate_number },
    { label: "Service", value: job.service },
    { label: "Scheduled Start", value: when(job.scheduled_at) },
    { label: "Estimated Completion", value: when(job.expected_completion_at) },
    ...(job.head_detailer ? [{ label: "Head Detailer", value: job.head_detailer.full_name }] : []),
    ...(job.head_installer ? [{ label: "Head Installer", value: job.head_installer.full_name }] : []),
  ]
  return fields
}

/** `${jobOrderCode}-receipt-YYYY-MM-DD.pdf` / `.xlsx`, dated in the shop's timezone. */
export function receiptFilename(jobOrderCode: string, kind: "pdf" | "xlsx", date: Date): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  return `${jobOrderCode}-receipt-${day}.${kind}`
}

/** A one-page print document. Opened with lib/export/print.ts's openPrintPreview. */
export function buildReceiptHtml(job: ExportJobDetail, generatedAt: string): string {
  const rows = receiptFields(job)
    .map((f) => `<tr><td>${escapeHtml(f.label)}</td><td>${escapeHtml(f.value)}</td></tr>`)
    .join("")
  const steps = STATUS_STEPS.map((s) => `<li>${escapeHtml(s)}</li>`).join("")

  return `<html><head><title>${escapeHtml(job.job_order_code)} Receipt</title>
    <style>
      body{font-family:sans-serif;font-size:12px;color:#111;margin:32px;max-width:640px}
      .brand{font-size:18px;font-weight:700}.branch{margin-top:2px;font-size:12px;color:#555}
      .meta{margin-top:6px;font-size:11px;color:#777}hr{border:none;border-top:2px solid #111;margin:14px 0 20px}
      h2{margin:0 0 4px}h3{margin:20px 0 6px;font-size:13px}
      .id-box{margin:16px 0 20px;padding:14px 16px;border:2px solid #111;border-radius:6px;text-align:center}
      .id-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#555}
      .id-value{margin-top:4px;font-size:28px;font-weight:700;letter-spacing:.06em;font-family:monospace}
      table{width:100%;border-collapse:collapse;margin-bottom:12px}
      td{border:1px solid ${PRINT_BORDER};padding:7px 9px;text-align:left;font-size:12px}
      td:first-child{background:${PRINT_HEAD_BG};font-weight:600;width:170px}
      ol{margin:6px 0;padding-left:20px}li{margin-bottom:4px}
      .note{margin-top:18px;font-size:11px;color:#555}
    </style>
    </head><body>
    <div class="brand">${escapeHtml(SHOP_NAME)}</div>
    <div class="branch">${escapeHtml(SHOP_BRANCH)}</div>
    <hr />
    <h2>Job Order Receipt</h2>
    <div class="meta">Issued on ${escapeHtml(generatedAt)}</div>

    <div class="id-box">
      <div class="id-label">Job Order ID</div>
      <div class="id-value">${escapeHtml(job.job_order_code)}</div>
    </div>

    <table>${rows}</table>

    <h3>How to check your vehicle status</h3>
    <ol>${steps}</ol>

    <p class="note">${escapeHtml(KEEP_NOTE)}</p>
    </body></html>`
}

/** The same receipt as a single-sheet .xlsx. Downloaded with downloadWorkbook. */
export function buildReceiptWorkbook(job: ExportJobDetail, generatedAt: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = SHOP_NAME
  wb.created = new Date()

  const sheet = wb.addWorksheet("Receipt")
  sheet.columns = [
    { header: "Field", key: "field", width: 24 },
    { header: "Value", key: "value", width: 50 },
  ]
  sheet.addRows([
    { field: "Job Order ID", value: job.job_order_code },
    { field: "Issued On", value: generatedAt },
    ...receiptFields(job).map((f) => ({ field: f.label, value: f.value })),
    { field: "How to check your vehicle status", value: STATUS_STEPS.join(" ") },
    { field: "Note", value: KEEP_NOTE },
  ])
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(2).font = { bold: true }
  sheet.getColumn("value").alignment = { wrapText: true, vertical: "top" }

  return wb
}
