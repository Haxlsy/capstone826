import ExcelJS from "exceljs"
import { escapeHtml, PRINT_BORDER, PRINT_HEAD_BG } from "@/lib/export/print"
import { fmtDateTime } from "@/lib/time-display"

export interface ExportMedia {
  id: string
  file_url: string
  media_type: "photo" | "video"
  rework_round?: number
  uploaded_at?: string
}

export interface ExportStage {
  name: string
  category_name: string | null
  status: string
  completed_at: string | null
  completion_notes: string | null
  rework_instructions: string | null
  rework_notes: { round: number; notes: string }[]
  media: ExportMedia[]
  rework_media: ExportMedia[]
}

export interface ExportHistoryEntry {
  status: string
  created_at: string
  changed_by: string
  reason: string | null
}

export interface ExportJobDetail {
  job_order_code: string
  status: string
  customer_name: string
  contact_number: string
  email: string | null
  vehicle_unit: string
  plate_number: string
  service: string
  scheduled_at: string | null
  actual_start_at: string | null
  expected_completion_at: string | null
  head_detailer: { full_name: string } | null
  head_installer: { full_name: string } | null
  history: ExportHistoryEntry[]
  stages: ExportStage[]
}

/** `${jobOrderCode}-YYYY-MM-DD.pdf` / `.xlsx`, dated in the shop's timezone. */
export function exportFilename(jobOrderCode: string, kind: "pdf" | "xlsx", date: Date): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
  return `${jobOrderCode}-${day}.${kind}`
}

/** Every photo attached to a stage, across the original upload and any
 *  rework rounds — videos are never included in either export. */
function photosOf(stage: ExportStage): ExportMedia[] {
  return [...stage.media, ...stage.rework_media].filter((m) => m.media_type === "photo")
}

// ── PDF (print preview) ─────────────────────────────────────────────────────

function stageSectionHtml(stage: ExportStage): string {
  const notes = [
    stage.completion_notes ? `Completion notes: ${escapeHtml(stage.completion_notes)}` : null,
    stage.rework_instructions ? `Rework instructions: ${escapeHtml(stage.rework_instructions)}` : null,
    ...stage.rework_notes.map((n) => `Round ${n.round} notes: ${escapeHtml(n.notes)}`),
  ].filter(Boolean)

  const photos = photosOf(stage)
  const photosHtml = photos.length > 0
    ? `<div class="photo-grid">${photos.map((m) => `<img src="${escapeHtml(m.file_url)}" />`).join("")}</div>`
    : ""

  return `<div class="stage">
    <h3>${escapeHtml(stage.name)}${stage.category_name ? ` <span class="muted">(${escapeHtml(stage.category_name)})</span>` : ""}</h3>
    <p class="muted">Status: ${escapeHtml(stage.status)} ${stage.completed_at ? `· Completed ${escapeHtml(fmtDateTime(stage.completed_at))}` : ""}</p>
    ${notes.length > 0 ? `<ul>${notes.map((n) => `<li>${n}</li>`).join("")}</ul>` : ""}
    ${photosHtml}
  </div>`
}

/**
 * A completed job order's full record as a printable HTML document — status
 * history, every stage with its technician notes across rework rounds, and
 * each stage's photos embedded inline. Videos are never included. Printed
 * via lib/export/print.ts's openPrintPreview, same as every other PDF export
 * in the app.
 */
export function buildPrintHtml(job: ExportJobDetail, generatedAt: string): string {
  const historyRows = job.history
    .map((h) => `<tr><td>${escapeHtml(fmtDateTime(h.created_at))}</td><td>${escapeHtml(h.status)}</td><td>${escapeHtml(h.changed_by)}</td><td>${escapeHtml(h.reason ?? "—")}</td></tr>`)
    .join("")

  return `<html><head><title>${escapeHtml(job.job_order_code)}</title>
    <style>
      body{font-family:sans-serif;font-size:12px;color:#111;margin:32px}
      .brand{font-size:18px;font-weight:700}.branch{margin-top:2px;font-size:12px;color:#555}
      .meta{margin-top:10px;font-size:11px;color:#777}hr{border:none;border-top:2px solid #111;margin:14px 0 20px}
      h2{margin:20px 0 8px}h3{margin:16px 0 4px}.muted{color:#777;font-weight:normal}
      table{width:100%;border-collapse:collapse;margin-bottom:12px}
      th,td{border:1px solid ${PRINT_BORDER};padding:6px 8px;text-align:left;font-size:11px}
      th{background:${PRINT_HEAD_BG};font-weight:600}
      .summary td:first-child{font-weight:600;width:160px}
      .stage{border:1px solid ${PRINT_BORDER};border-radius:4px;padding:10px 12px;margin-bottom:10px}
      ul{margin:6px 0;padding-left:18px}li{margin-bottom:3px}
      .photo-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
      .photo-grid img{width:140px;height:105px;object-fit:cover;border:1px solid ${PRINT_BORDER};border-radius:3px}
    </style>
    </head><body>
    <div class="brand">826 Auto Aesthetic &amp; Protection</div>
    <div class="branch">Ortigas Extension</div>
    <hr />
    <h2>Job Order Record — ${escapeHtml(job.job_order_code)}</h2>
    <div class="meta">Generated on ${escapeHtml(generatedAt)} · Status: ${escapeHtml(job.status)}</div>

    <table class="summary">
      <tr><td>Customer</td><td>${escapeHtml(job.customer_name)}</td></tr>
      <tr><td>Contact Number</td><td>${escapeHtml(job.contact_number)}</td></tr>
      <tr><td>Email</td><td>${escapeHtml(job.email ?? "—")}</td></tr>
      <tr><td>Vehicle</td><td>${escapeHtml(job.vehicle_unit)}</td></tr>
      <tr><td>Plate Number</td><td>${escapeHtml(job.plate_number)}</td></tr>
      <tr><td>Service</td><td>${escapeHtml(job.service)}</td></tr>
      <tr><td>Scheduled</td><td>${job.scheduled_at ? escapeHtml(fmtDateTime(job.scheduled_at)) : "—"}</td></tr>
      <tr><td>Released</td><td>${job.expected_completion_at ? escapeHtml(fmtDateTime(job.expected_completion_at)) : "—"}</td></tr>
      <tr><td>Head Detailer</td><td>${escapeHtml(job.head_detailer?.full_name ?? "—")}</td></tr>
      <tr><td>Head Installer</td><td>${escapeHtml(job.head_installer?.full_name ?? "—")}</td></tr>
    </table>

    <h2>Status History</h2>
    <table>
      <thead><tr><th>Time</th><th>Status</th><th>Changed By</th><th>Reason</th></tr></thead>
      <tbody>${historyRows || `<tr><td colspan="4">No history recorded.</td></tr>`}</tbody>
    </table>

    <h2>Workflow Stages</h2>
    ${job.stages.map(stageSectionHtml).join("")}
    </body></html>`
}

// ── Excel (real multi-sheet workbook) ───────────────────────────────────────

/**
 * A completed job order's full record as a real multi-sheet .xlsx workbook —
 * Summary, Status History, Stages, and Photos (links, not embedded pixels;
 * embedding would require fetching each photo's raw bytes client-side, which
 * depends on storage CORS policy — a link is simpler and equally complete).
 * Videos are never included. Downloaded via lib/export/print.ts's downloadWorkbook.
 */
export function buildWorkbook(job: ExportJobDetail): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = "826 Auto Aesthetic & Protection"
  wb.created = new Date()

  const summary = wb.addWorksheet("Summary")
  summary.columns = [
    { header: "Field", key: "field", width: 22 },
    { header: "Value", key: "value", width: 50 },
  ]
  summary.addRows([
    { field: "Job Order ID", value: job.job_order_code },
    { field: "Status", value: job.status },
    { field: "Customer", value: job.customer_name },
    { field: "Contact Number", value: job.contact_number },
    { field: "Email", value: job.email ?? "—" },
    { field: "Vehicle", value: job.vehicle_unit },
    { field: "Plate Number", value: job.plate_number },
    { field: "Service", value: job.service },
    { field: "Scheduled", value: job.scheduled_at ? fmtDateTime(job.scheduled_at) : "—" },
    { field: "Actual Start", value: job.actual_start_at ? fmtDateTime(job.actual_start_at) : "—" },
    { field: "Released", value: job.expected_completion_at ? fmtDateTime(job.expected_completion_at) : "—" },
    { field: "Head Detailer", value: job.head_detailer?.full_name ?? "—" },
    { field: "Head Installer", value: job.head_installer?.full_name ?? "—" },
  ])
  summary.getRow(1).font = { bold: true }

  const history = wb.addWorksheet("Status History")
  history.columns = [
    { header: "Time", key: "time", width: 20 },
    { header: "Status", key: "status", width: 16 },
    { header: "Changed By", key: "by", width: 22 },
    { header: "Reason", key: "reason", width: 40 },
  ]
  history.addRows(job.history.map((h) => ({
    time: fmtDateTime(h.created_at), status: h.status, by: h.changed_by, reason: h.reason ?? "—",
  })))
  history.getRow(1).font = { bold: true }

  const stages = wb.addWorksheet("Stages")
  stages.columns = [
    { header: "Stage", key: "stage", width: 24 },
    { header: "Category", key: "category", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Completed At", key: "completed", width: 20 },
    { header: "Notes", key: "notes", width: 60 },
  ]
  for (const s of job.stages) {
    const notes = [
      s.completion_notes ? `Completion: ${s.completion_notes}` : null,
      s.rework_instructions ? `Rework: ${s.rework_instructions}` : null,
      ...s.rework_notes.map((n) => `Round ${n.round}: ${n.notes}`),
    ].filter(Boolean).join(" | ")
    stages.addRow({
      stage: s.name, category: s.category_name ?? "—", status: s.status,
      completed: s.completed_at ? fmtDateTime(s.completed_at) : "—", notes: notes || "—",
    })
  }
  stages.getRow(1).font = { bold: true }

  const photos = wb.addWorksheet("Photos")
  photos.columns = [
    { header: "Stage", key: "stage", width: 24 },
    { header: "Round", key: "round", width: 10 },
    { header: "Uploaded At", key: "uploaded", width: 20 },
    { header: "Link", key: "link", width: 60 },
  ]
  for (const s of job.stages) {
    for (const m of photosOf(s)) {
      const row = photos.addRow({
        stage: s.name,
        round: m.rework_round ?? 0,
        uploaded: m.uploaded_at ? fmtDateTime(m.uploaded_at) : "—",
      })
      row.getCell("link").value = { text: "View photo", hyperlink: m.file_url }
    }
  }
  photos.getRow(1).font = { bold: true }

  return wb
}
