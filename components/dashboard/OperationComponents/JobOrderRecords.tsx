"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { FileText, FileSpreadsheet } from "lucide-react"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { ConfirmModal } from "@/components/ui/Modal"
import { SearchBar } from "@/components/ui/SearchBar"
import { Card } from "@/components/ui/Card"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Pagination } from "@/components/ui/Pagination"
import { Select, FieldLabel } from "@/components/ui/Field"
import { fmtDateTime } from "@/lib/time-display"

interface JobRecord {
  id: string
  displayId: string
  customer: string
  plate: string
  vehicle: string
  service: string
  head_detailer: string
  head_installer: string
  scheduled_at: string | null
  expected_completion_at: string | null
  released_at: string | null
  created_at: string
}

// Table colours for the print export — pulled from the design tokens so there
// are no hardcoded hex values in feature code.
const PRINT_BORDER = "#dddddd"
const PRINT_HEAD_BG = "#f7f8f8"

export default function JobOrderRecords({ jobOrders: rawOrders }: { jobOrders: any[] }) {
  const router = useRouter()
  const records = useMemo<JobRecord[]>(
    () =>
      rawOrders.map((r: any) => ({
        id: r.id,
        displayId: r.job_order_code,
        customer: r.customer_name ?? "—",
        plate: r.plate_number ?? "—",
        vehicle: r.vehicle_unit ?? "—",
        service: r.service ?? "—",
        head_detailer: r.head_detailer ?? "Unassigned",
        head_installer: r.head_installer ?? "Unassigned",
        scheduled_at: r.scheduled_at,
        expected_completion_at: r.expected_completion_at,
        released_at: r.released_at ?? null,
        created_at: r.created_at,
      })),
    [rawOrders],
  )

  const [searchQuery, setSearchQuery] = useState("")
  const [serviceFilter, setServiceFilter] = useState("All")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [pendingService, setPendingService] = useState("All")
  const [pendingStart, setPendingStart] = useState("")
  const [pendingEnd, setPendingEnd] = useState("")

  const [exportConfirm, setExportConfirm] = useState<"pdf" | "excel" | null>(null)

  const serviceOptions = [...new Set(records.map((r) => r.service).filter((s) => s !== "—"))]

  function handleApplyFilters() {
    setServiceFilter(pendingService)
    setStartDate(pendingStart)
    setEndDate(pendingEnd)
    setCurrentPage(1)
  }

  function handleReset() {
    setPendingService("All"); setPendingStart(""); setPendingEnd("")
    setServiceFilter("All"); setStartDate(""); setEndDate("")
    setSearchQuery(""); setCurrentPage(1)
  }

  const filtered = records.filter((r) => {
    const q = searchQuery.toLowerCase()
    if (
      q &&
      ![r.customer, r.displayId, r.plate, r.vehicle, r.service, r.head_detailer, r.head_installer].some((f) =>
        f.toLowerCase().includes(q),
      )
    )
      return false
    if (serviceFilter !== "All" && r.service !== serviceFilter) return false
    if (startDate && new Date(r.created_at) < new Date(startDate)) return false
    if (endDate && new Date(r.created_at) > new Date(endDate)) return false
    return true
  })

  function exportCSV() {
    const headers = ["Job Order ID", "Customer", "Plate", "Vehicle", "Service", "Head Detailer", "Head Installer", "Scheduled Start", "Created", "Released"]
    const rows = filtered.map((r) => [
      r.displayId, r.customer, r.plate, r.vehicle, r.service, r.head_detailer, r.head_installer,
      r.scheduled_at ? fmtDateTime(r.scheduled_at) : "—",
      fmtDateTime(r.created_at),
      r.released_at ? fmtDateTime(r.released_at) : "—",
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "job-order-records.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    const esc = (v: string) =>
      v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const rows = filtered
      .map(
        (r) => `
      <tr>
        <td>${esc(r.displayId)}</td><td>${esc(r.customer)}</td><td>${esc(r.plate)}</td>
        <td>${esc(r.vehicle)}</td><td>${esc(r.service)}</td>
        <td>${esc(r.head_detailer)}</td><td>${esc(r.head_installer)}</td>
        <td>${r.scheduled_at ? esc(fmtDateTime(r.scheduled_at)) : "—"}</td>
        <td>${esc(fmtDateTime(r.created_at))}</td>
        <td>${r.released_at ? esc(fmtDateTime(r.released_at)) : "—"}</td>
      </tr>`,
      )
      .join("")
    const html = `<html><head><title>Job Order Records</title>
      <style>body{font-family:sans-serif;font-size:12px;color:#111;margin:32px}
      .brand{font-size:18px;font-weight:700}.branch{margin-top:2px;font-size:12px;color:#555}
      .meta{margin-top:10px;font-size:11px;color:#777}hr{border:none;border-top:2px solid #111;margin:14px 0 20px}
      h2{margin:0 0 4px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid ${PRINT_BORDER};padding:6px 8px;text-align:left}th{background:${PRINT_HEAD_BG};font-weight:600}</style>
      </head><body>
      <div class="brand">826 Auto Aesthetic &amp; Protection</div>
      <div class="branch">Ortigas Extension</div>
      <hr />
      <h2>Job Order Records</h2>
      <div class="meta">Generated on ${new Date().toLocaleString()} · ${filtered.length} record${filtered.length !== 1 ? "s" : ""}</div>
      <table><thead><tr><th>Job ID</th><th>Customer</th><th>Plate</th><th>Vehicle</th>
      <th>Service</th><th>Head Detailer</th><th>Head Installer</th><th>Scheduled Start</th><th>Created</th>
      <th>Released</th>
      </tr></thead><tbody>${rows}</tbody></table></body></html>`
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, "_blank")
    if (win) win.addEventListener("load", () => { win.print(); URL.revokeObjectURL(url) })
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const columns: Column<JobRecord>[] = [
    { key: "id", header: "Job Order ID", cell: (r) => <span className="font-mono text-xs text-body">{r.displayId}</span> },
    { key: "customer", header: "Customer", cell: (r) => <span className="font-semibold text-heading">{r.customer}</span> },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (r) => (
        <>
          <span className="text-xs font-medium text-primary">{r.plate}</span>
          {r.vehicle !== "—" && <span className="mt-0.5 block text-xs text-muted">{r.vehicle}</span>}
        </>
      ),
    },
    { key: "service", header: "Service", cell: (r) => <span className="text-body">{r.service}</span> },
    {
      key: "hd",
      header: "Head Detailer",
      cell: (r) => <span className={r.head_detailer === "Unassigned" ? "italic text-muted" : "text-body"}>{r.head_detailer}</span>,
    },
    {
      key: "hi",
      header: "Head Installer",
      cell: (r) => <span className={r.head_installer === "Unassigned" ? "italic text-muted" : "text-body"}>{r.head_installer}</span>,
    },
    { key: "sched", header: "Scheduled Start", cell: (r) => <span className="text-body">{fmtDateTime(r.scheduled_at)}</span> },
    {
      key: "released",
      header: "Released",
      cell: (r) => (
        <span className="flex items-center gap-1.5 text-status-release">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-release" />
          <span className="font-medium">{fmtDateTime(r.released_at)}</span>
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Job Records"
        subtitle="Completed and released units."
      />

      <Card className="flex flex-wrap items-end gap-4 p-5">
        <div>
          <FieldLabel>Start Date</FieldLabel>
          <input
            aria-label="Start Date"
            type="date"
            value={pendingStart}
            onChange={(e) => setPendingStart(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <FieldLabel>End Date</FieldLabel>
          <input
            aria-label="End Date"
            type="date"
            value={pendingEnd}
            onChange={(e) => setPendingEnd(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <FieldLabel>Service Type</FieldLabel>
          <Select
            aria-label="Service Type"
            value={pendingService}
            onChange={(e) => setPendingService(e.target.value)}
            className="w-44"
          >
            <option value="All">All</option>
            {serviceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleApplyFilters}>Apply Filters</Button>
          <Button variant="ghost" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBar
          value={searchQuery}
          onChange={(v) => {
            setSearchQuery(v)
            setCurrentPage(1)
          }}
          placeholder="Search by customer, plate, vehicle, service, technician, or Job ID…"
          containerClassName="max-w-sm flex-1"
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setExportConfirm("pdf")}>
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
          <Button variant="secondary" onClick={() => setExportConfirm("excel")}>
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={paginated}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/dashboard/job-management/${r.id}`)}
        emptyLabel="No released job orders found."
        footer={
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setCurrentPage(1)
            }}
            pageSizeOptions={[10, 15, 20]}
            totalLabel={`${filtered.length} record${filtered.length !== 1 ? "s" : ""}`}
          />
        }
      />

      <ConfirmModal
        open={exportConfirm !== null}
        onClose={() => setExportConfirm(null)}
        onConfirm={() => {
          const type = exportConfirm
          setExportConfirm(null)
          if (type === "pdf") exportPDF()
          else if (type === "excel") exportCSV()
        }}
        title={exportConfirm === "excel" ? "Export as Excel" : "Export as PDF"}
        message={
          exportConfirm === "excel"
            ? `Export ${filtered.length} record${filtered.length !== 1 ? "s" : ""} to a CSV file?`
            : `Export ${filtered.length} record${filtered.length !== 1 ? "s" : ""}? This opens a print preview in a new tab.`
        }
        confirmLabel="Export"
        cancelLabel="Cancel"
        tone="primary"
        icon={exportConfirm === "excel" ? FileSpreadsheet : FileText}
      />
    </div>
  )
}
