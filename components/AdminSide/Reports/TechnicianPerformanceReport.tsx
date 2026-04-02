"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Table, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { exportToCSV, exportToPDF, formatDate, formatDateTime, formatJobId } from "./ExportUtils"

type JobStatus = "pending" | "ongoing" | "quality_check" | "completed" | "delayed" | "cancelled" | "released"

interface TechSummary {
  user_id: string
  full_name: string
  completed: number
  inProgress: number
  flagged: number
}

interface DetailRow {
  job_order_id: number
  plate_number: string | null
  car_make: string | null
  car_model: string | null
  current_status: JobStatus
  scheduled_start: string | null
  scheduled_end: string | null
  updated_at: string
  service: { service_name: string } | null
  technicianName: string
  technicianId: string
}

interface FilterState {
  technicianId: string
  startDate: string
  endDate: string
  status: string
}

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending", ongoing: "Ongoing", quality_check: "Quality Check",
  completed: "Completed", delayed: "Delayed", cancelled: "Cancelled", released: "Released",
}

const IN_PROGRESS_STATUSES: JobStatus[] = ["pending", "ongoing", "quality_check", "delayed"]
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30]

function getInitials(name: string) {
  const parts = name.trim().split(" ")
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

export default function TechnicianPerformanceReport() {
  const supabase = createClient()

  const [summaries, setSummaries] = useState<TechSummary[]>([])
  const [detailRows, setDetailRows] = useState<DetailRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [technicianOptions, setTechnicianOptions] = useState<{ user_id: string; full_name: string }[]>([])

  const [filters, setFilters] = useState<FilterState>({
    technicianId: "all", startDate: "", endDate: "", status: "all",
  })
  const [applied, setApplied] = useState(filters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  useEffect(() => { loadData() }, [])
  useEffect(() => { setPage(1) }, [applied, pageSize])
  useEffect(() => { fetchDetail() }, [applied, page, pageSize])

  async function loadData() {
    // Fetch technicians
    const { data: techs } = await supabase
      .from("profile")
      .select("user_id, full_name")
      .in("role", ["technician", "head_technician"])
      .eq("is_archived", false)
      .order("full_name")

    setTechnicianOptions(techs ?? [])

    // Fetch all job orders for summary cards
    const { data: allJobs } = await supabase
      .from("job_order")
      .select("job_order_id, assigned_technician_id, current_status")
      .not("assigned_technician_id", "is", null)

    // Fetch flagged (open) concerns per job
    const { data: concerns } = await supabase
      .from("job_concern")
      .select("job_order_id")
      .eq("status", "open")

    const flaggedJobIds = new Set((concerns ?? []).map((c) => c.job_order_id))

    // Build summaries per technician
    const summaryMap: Record<string, TechSummary> = {}
    for (const tech of techs ?? []) {
      summaryMap[tech.user_id] = {
        user_id: tech.user_id,
        full_name: tech.full_name,
        completed: 0,
        inProgress: 0,
        flagged: 0,
      }
    }

    for (const job of allJobs ?? []) {
      const s = summaryMap[job.assigned_technician_id]
      if (!s) continue
      if (job.current_status === "completed" || job.current_status === "released") {
        s.completed++
      } else if (IN_PROGRESS_STATUSES.includes(job.current_status as JobStatus)) {
        s.inProgress++
      }
      if (flaggedJobIds.has(job.job_order_id)) s.flagged++
    }

    setSummaries(Object.values(summaryMap))
  }

  async function fetchDetail() {
    setLoading(true)

    let q = supabase
      .from("job_order")
      .select(
        `job_order_id, plate_number, car_make, car_model, current_status,
         scheduled_start, scheduled_end, updated_at,
         service:service_id(service_name),
         technician:assigned_technician_id(user_id, full_name)`,
        { count: "exact" }
      )
      .not("assigned_technician_id", "is", null)
      .order("scheduled_start", { ascending: false })

    if (applied.technicianId !== "all") q = q.eq("assigned_technician_id", applied.technicianId)
    if (applied.status !== "all") q = q.eq("current_status", applied.status)
    if (applied.startDate) q = q.gte("scheduled_start", `${applied.startDate}T00:00:00Z`)
    if (applied.endDate) q = q.lte("scheduled_start", `${applied.endDate}T23:59:59Z`)

    const from = (page - 1) * pageSize
    q = q.range(from, from + pageSize - 1)

    const { data, count, error } = await q
    if (!error) {
      const rows: DetailRow[] = (data as any[]).map((d) => ({
        ...d,
        technicianName: d.technician?.full_name ?? "—",
        technicianId: d.technician?.user_id ?? "",
      }))
      setDetailRows(rows)
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }

  function handleExportCSV() {
    const csvRows = detailRows.map((r) => ({
      Technician: r.technicianName,
      "Job Order ID": formatJobId(r.job_order_id),
      Vehicle: `${r.plate_number ?? "—"} — ${[r.car_make, r.car_model].filter(Boolean).join(" ")}`,
      Service: r.service?.service_name ?? "—",
      "Time Started": formatDateTime(r.scheduled_start),
      "Time Completed":
        r.current_status === "completed" || r.current_status === "released"
          ? formatDateTime(r.updated_at) : "—",
      Status: STATUS_LABEL[r.current_status],
    }))
    exportToCSV(csvRows, "technician-performance-log.csv")
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 print:p-0">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400">
        <Link href="/dashboard/admin/reports" className="hover:text-gray-600 transition-colors">Reports</Link>
        <span className="mx-1.5">›</span>
        <span className="text-gray-600 font-medium">Technician Performance Log</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-800">Technician Performance Log</h1>

      {/* Summary Cards */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
          {summaries.map((t) => (
            <div key={t.user_id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center shrink-0">
                  {getInitials(t.full_name)}
                </div>
                <span className="text-sm font-semibold text-gray-800 truncate">{t.full_name}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed</span>
                  <span className="font-semibold text-gray-800">{t.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">In Progress</span>
                  <span className="font-semibold text-gray-800">{t.inProgress}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Flagged</span>
                  <span className={`font-semibold flex items-center gap-1 ${t.flagged > 0 ? "text-orange-500" : "text-gray-800"}`}>
                    {t.flagged > 0 && <AlertTriangle className="w-3 h-3" />}
                    {t.flagged}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Technician</label>
            <select value={filters.technicianId}
              onChange={(e) => setFilters((p) => ({ ...p, technicianId: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none bg-white">
              <option value="all">All</option>
              {technicianOptions.map((t) => (
                <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Start Date</label>
            <input type="date" value={filters.startDate}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">End Date</label>
            <input type="date" value={filters.endDate}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Status</label>
            <select value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none bg-white">
              <option value="all">All</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setApplied(filters)}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
              Apply Filters
            </button>
            <button onClick={() => {
              const reset = { technicianId: "all", startDate: "", endDate: "", status: "all" }
              setFilters(reset); setApplied(reset)
            }} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-end gap-2 print:hidden">
        <button onClick={exportToPDF}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
          <FileText className="w-4 h-4" /> Export PDF
        </button>
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
          <Table className="w-4 h-4" /> Export Excel
        </button>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {["Technician", "Job Order ID", "Vehicle", "Service", "Time Started", "Time Completed", ""].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-gray-400">Loading...</td></tr>
            ) : detailRows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-gray-400">No records found.</td></tr>
            ) : detailRows.map((r) => (
              <tr key={r.job_order_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3.5 font-medium text-gray-800">{r.technicianName}</td>
                <td className="px-4 py-3.5 text-gray-600">{formatJobId(r.job_order_id)}</td>
                <td className="px-4 py-3.5 text-blue-500 whitespace-nowrap">
                  {r.plate_number ?? "—"} — {[r.car_make, r.car_model].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-4 py-3.5 text-blue-500">{r.service?.service_name ?? "—"}</td>
                <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{formatDateTime(r.scheduled_start)}</td>
                <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">
                  {r.current_status === "completed" || r.current_status === "released"
                    ? formatDateTime(r.updated_at) : "—"}
                </td>
                <td className="px-4 py-3.5">
                  <button className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 print:hidden">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show Results:</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none">
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<(number | "...")[]>((acc, n, i, arr) => {
                if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push("...")
                acc.push(n); return acc
              }, [])
              .map((item, i) => item === "..." ? (
                <span key={`e${i}`} className="px-2 text-gray-400 text-sm">...</span>
              ) : (
                <button key={item} onClick={() => setPage(item as number)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === item ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                  {item}
                </button>
              ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
