"use client"

import { useState, useEffect } from "react"
import { Search, ChevronLeft, ChevronRight, FileText, FileSpreadsheet } from "lucide-react"
import JobHistoryDrawer, { type JobOrderFull } from "./JobHistoryDrawer"

const DB_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  ongoing: "Ongoing",
  quality_check: "Quality Check",
  completed: "Completed",
  delayed: "Delayed",
  cancelled: "Cancelled",
  released: "Released",
}

const statusBadgeMap: Record<JobOrderFull["status"], string> = {
  Released:        "bg-teal-100 text-teal-600",
  Completed:       "bg-green-100 text-green-600",
  Delayed:         "bg-red-100 text-red-500",
  Ongoing:         "bg-blue-100 text-blue-600",
  Pending:         "bg-amber-100 text-amber-600",
  "Quality Check": "bg-orange-100 text-orange-500",
  Cancelled:       "bg-gray-100 text-gray-500",
}

function mapApiToRecord(r: any): JobOrderFull {
  const year = r.created_at ? new Date(r.created_at).getFullYear() : new Date().getFullYear()
  const statusLabel = DB_STATUS_LABEL[r.current_status] ?? r.current_status ?? "Pending"
  return {
    id: `JO-${year}-${String(r.job_order_id).padStart(3, "0")}`,
    customer: r.customer?.full_name ?? "—",
    vehicle: r.plate_number ?? "—",
    service: r.service?.service_name ?? "—",
    technician: r.assigned_technician?.full_name ?? "Unassigned",
    status: statusLabel as JobOrderFull["status"],
    created: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    completed: r.scheduled_end
      ? new Date(r.scheduled_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null,
    history: [],
    stages: [],
    documentation: 0,
    _raw_id: r.job_order_id,
  } as any
}

export default function JobOrderRecords() {
  const [records, setRecords] = useState<(JobOrderFull & { _raw_id: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState<JobOrderFull | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Filter options derived from data
  const [serviceOptions, setServiceOptions] = useState<string[]>([])
  const [technicianOptions, setTechnicianOptions] = useState<string[]>([])

  // Applied filters
  const [searchQuery, setSearchQuery] = useState("")
  const [serviceTypeFilter, setServiceTypeFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [technicianFilter, setTechnicianFilter] = useState("All")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // Pending (not-yet-applied) filter state
  const [pendingService, setPendingService] = useState("All")
  const [pendingStatus, setPendingStatus] = useState("All")
  const [pendingTechnician, setPendingTechnician] = useState("All")
  const [pendingStart, setPendingStart] = useState("")
  const [pendingEnd, setPendingEnd] = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch("/api/operations/Job%20Management/list-job-orders")
        const json = await res.json()
        if (res.ok) {
          const mapped = (json.job_orders ?? []).map(mapApiToRecord)
          setRecords(mapped)
          setServiceOptions([...new Set(mapped.map((r: any) => r.service).filter((s: string) => s !== "—"))] as string[])
          setTechnicianOptions([...new Set(mapped.map((r: any) => r.technician).filter((t: string) => t !== "Unassigned"))] as string[])
        }
      } catch {
        // leave empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleViewHistory(record: JobOrderFull & { _raw_id: number }) {
    // If we already loaded the history for this record, just show it
    if (record.history.length > 0 || record.stages.length > 0) {
      setSelectedRecord(record)
      return
    }
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/operations/job-orders/${record._raw_id}`)
      const json = await res.json()
      if (res.ok && json.job) {
        const enriched = { ...record, ...json.job }
        // Update the record in state too so repeat clicks don't re-fetch
        setRecords((prev) => prev.map((r) => r._raw_id === record._raw_id ? enriched : r))
        setSelectedRecord(enriched)
      } else {
        setSelectedRecord(record)
      }
    } catch {
      setSelectedRecord(record)
    } finally {
      setDetailLoading(false)
    }
  }

  function handleApplyFilters() {
    setServiceTypeFilter(pendingService)
    setStatusFilter(pendingStatus)
    setTechnicianFilter(pendingTechnician)
    setStartDate(pendingStart)
    setEndDate(pendingEnd)
    setCurrentPage(1)
  }

  function handleReset() {
    setPendingService("All"); setPendingStatus("All"); setPendingTechnician("All")
    setPendingStart(""); setPendingEnd("")
    setServiceTypeFilter("All"); setStatusFilter("All"); setTechnicianFilter("All")
    setStartDate(""); setEndDate(""); setSearchQuery(""); setCurrentPage(1)
  }

  const filtered = records.filter((record) => {
    const q = searchQuery.toLowerCase()
    if (q && !record.customer.toLowerCase().includes(q) && !record.id.toLowerCase().includes(q)) return false
    if (serviceTypeFilter !== "All" && record.service !== serviceTypeFilter) return false
    if (statusFilter !== "All" && record.status !== statusFilter) return false
    if (technicianFilter !== "All" && record.technician !== technicianFilter) return false
    if (startDate) {
      const created = new Date(record.created)
      if (created < new Date(startDate)) return false
    }
    if (endDate) {
      const created = new Date(record.created)
      if (created > new Date(endDate)) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const labelClass = "block text-xs font-medium text-gray-500 mb-1"
  const inputClass = "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"

  return (
    <>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Job Order Records</h1>
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
          <div>
            <label className={labelClass}>Status</label>
            <select value={pendingStatus} onChange={(e) => setPendingStatus(e.target.value)} className={inputClass}>
              <option value="All">All</option>
              {["Pending","Ongoing","Quality Check","Completed","Delayed","Released","Cancelled"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Technician</label>
            <select value={pendingTechnician} onChange={(e) => setPendingTechnician(e.target.value)} className={inputClass}>
              <option value="All">All</option>
              {technicianOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleApplyFilters} className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-gray-800 transition-colors">
              Apply Filters
            </button>
            <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer ml-1 transition-colors">
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
              placeholder="Search by customer or job ID..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-colors bg-white">
              <FileText className="w-4 h-4" />Export PDF
            </button>
            <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-colors bg-white">
              <FileSpreadsheet className="w-4 h-4" />Export Excel
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Job Order ID","Customer","Vehicle","Service","Technician","Status","Created","Completed",""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">Loading job orders…</td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">No job order records found.</td>
                </tr>
              ) : paginated.map((record, idx) => (
                <tr
                  key={record.id}
                  className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx === paginated.length - 1 ? "border-b-0" : ""}`}
                >
                  <td className="px-4 py-3.5"><span className="text-xs font-mono text-gray-500">{record.id}</span></td>
                  <td className="px-4 py-3.5"><span className="text-sm font-semibold text-gray-800">{record.customer}</span></td>
                  <td className="px-4 py-3.5"><span className="text-sm text-blue-500">{record.vehicle}</span></td>
                  <td className="px-4 py-3.5"><span className="text-sm text-gray-700">{record.service}</span></td>
                  <td className="px-4 py-3.5"><span className="text-sm text-gray-600">{record.technician}</span></td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeMap[record.status]}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5"><span className="text-sm text-gray-600">{record.created}</span></td>
                  <td className="px-4 py-3.5">
                    {record.completed
                      ? <span className="text-sm text-gray-600">{record.completed}</span>
                      : <span className="text-sm text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleViewHistory(record)}
                      disabled={detailLoading}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {detailLoading && selectedRecord?.id === record.id ? "Loading…" : "View History"}
                    </button>
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

      <JobHistoryDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </>
  )
}
