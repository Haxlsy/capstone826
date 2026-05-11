"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, ChevronLeft, ChevronRight, FileText, FileSpreadsheet, CheckCircle2 } from "lucide-react"
import { JobOrderRecordsSkeleton } from "@/app/dashboard/job-order-records/loading"

interface JobRecord {
  id:                     string   // UUID
  displayId:              string   // e.g. "JO-2026-ABC1"
  customer:               string
  plate:                  string
  vehicle:                string
  service:                string
  head_detailer:          string
  head_installer:         string
  scheduled_at:           string | null
  expected_completion_at: string | null
  released_at:            string | null
  created_at:             string
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  })
}

export default function JobOrderRecords() {
  const router = useRouter()
  const [records, setRecords]       = useState<JobRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [serviceFilter, setServiceFilter] = useState("All")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate]     = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize]       = useState(15)

  // Pending (not-yet-applied) filter state
  const [pendingService, setPendingService] = useState("All")
  const [pendingStart, setPendingStart]     = useState("")
  const [pendingEnd, setPendingEnd]         = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res  = await fetch("/api/operations/job-management/list-job-orders?released=1")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load records")

      const mapped: JobRecord[] = (json.job_orders ?? []).map((r: any) => ({
        id:                     r.id,
        displayId:              `JO-${new Date(r.created_at).getFullYear()}-${r.id.slice(-4).toUpperCase()}`,
        customer:               r.customer_name ?? "—",
        plate:                  r.plate_number  ?? "—",
        vehicle:                r.vehicle_unit  ?? "—",
        service:                r.service       ?? "—",
        head_detailer:          r.head_detailer ?? "Unassigned",
        head_installer:         r.head_installer ?? "Unassigned",
        scheduled_at:           r.scheduled_at,
        expected_completion_at: r.expected_completion_at,
        released_at:            r.released_at ?? null,
        created_at:             r.created_at,
      }))

      setRecords(mapped)
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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
    if (q && ![r.customer, r.displayId, r.plate, r.vehicle, r.service, r.head_detailer, r.head_installer]
      .some((f) => f.toLowerCase().includes(q))) return false
    if (serviceFilter !== "All" && r.service !== serviceFilter) return false
    if (startDate && new Date(r.created_at) < new Date(startDate)) return false
    if (endDate   && new Date(r.created_at) > new Date(endDate))   return false
    return true
  })

  function exportCSV() {
    const headers = ["Job Order ID","Customer","Plate","Vehicle","Service","Head Detailer","Head Installer","Scheduled Start","Created", "Released"]
    const rows = filtered.map((r) => [
      r.displayId, r.customer, r.plate, r.vehicle, r.service,
      r.head_detailer, r.head_installer,
      r.scheduled_at ? fmtDate(r.scheduled_at) : "—",
      fmtDate(r.created_at),
      r.released_at ? fmtDateTime(r.released_at) : "—"
    ])
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = "job-order-records.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    const rows = filtered.map((r) => `
      <tr>
        <td>${r.displayId}</td><td>${r.customer}</td><td>${r.plate}</td>
        <td>${r.vehicle}</td><td>${r.service}</td>
        <td>${r.head_detailer}</td><td>${r.head_installer}</td>
        <td>${r.scheduled_at ? fmtDate(r.scheduled_at) : "—"}</td>
        <td>${fmtDate(r.created_at)}</td>
        <td>${r.released_at ? fmtDateTime(r.released_at) : "—"}</td>
      </tr>`).join("")
    const html = `<html><head><title>Job Order Records</title>
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-weight:600}</style>
      </head><body><h2>Job Order Records</h2>
      <table><thead><tr><th>Job ID</th><th>Customer</th><th>Plate</th><th>Vehicle</th>
      <th>Service</th><th>Head Detailer</th><th>Head Installer</th><th>Scheduled Start</th><th>Created</th>
      <th>Released</th>
      </tr></thead><tbody>${rows}</tbody></table></body></html>`
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, "_blank")
    if (win) win.addEventListener("load", () => { win.print(); URL.revokeObjectURL(url) })
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const labelClass = "block text-xs font-medium text-gray-500 mb-1"
  const inputClass = "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"

  if (loading) return <JobOrderRecordsSkeleton />

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Job Records</h1>
          <p className="text-sm text-gray-400 mt-0.5">Completed and released units.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-teal-50 text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed Only
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-end gap-4 flex-wrap">
        <div>
          <label className={labelClass}>Start Date</label>
          <input type="date" value={pendingStart} onChange={(e) => setPendingStart(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>End Date</label>
          <input type="date" value={pendingEnd} onChange={(e) => setPendingEnd(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Service Type</label>
          <select value={pendingService} onChange={(e) => setPendingService(e.target.value)} className={inputClass}>
            <option value="All">All</option>
            {serviceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleApplyFilters} className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-gray-800 transition-colors">
            Apply Filters
          </button>
          <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700 transition-colors ml-1">
            Reset
          </button>
        </div>
      </div>

      {/* Search + Export */}
      <div className="flex items-center justify-between">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer, plate, vehicle, service, technician, or Job ID…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportPDF} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-colors bg-white">
            <FileText className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={exportCSV} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-colors bg-white">
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Job Order ID", "Customer", "Vehicle", "Service", "Head Detailer", "Head Installer", "Scheduled Start", "Released"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">Loading records…</td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-red-500">{fetchError}</td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                  No released job orders found.
                </td>
              </tr>
            ) : paginated.map((r, idx) => (
              <tr
                key={r.id}
                onClick={() => router.push(`/dashboard/job-management/${r.id}`)}
                className={`border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors ${idx === paginated.length - 1 ? "border-b-0" : ""}`}
              >
                <td className="px-4 py-3.5">
                  <span className="text-xs font-mono text-gray-500">{r.displayId}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="font-semibold text-gray-800">{r.customer}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-blue-500 font-medium">{r.plate}</span>
                  {r.vehicle !== "—" && (
                    <span className="text-xs text-gray-400 block mt-0.5">{r.vehicle}</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-gray-700">{r.service}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-sm ${r.head_detailer === "Unassigned" ? "text-gray-400 italic" : "text-gray-700"}`}>
                    {r.head_detailer}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-sm ${r.head_installer === "Unassigned" ? "text-gray-400 italic" : "text-gray-700"}`}>
                    {r.head_installer}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-gray-500">{fmtDate(r.scheduled_at)}</span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                    <span className="text-sm text-teal-700 font-medium">
                      {fmtDateTime(r.released_at)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Show Results:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-gray-400 ml-2">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                page === currentPage ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
