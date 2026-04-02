"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Table } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { exportToCSV, exportToPDF, formatDate, formatJobId } from "./ExportUtils"
import { ChevronLeft, ChevronRight } from "lucide-react"

type JobStatus =
  | "pending" | "ongoing" | "quality_check" | "completed"
  | "delayed" | "cancelled" | "released"

interface JobRow {
  job_order_id: number
  plate_number: string | null
  car_make: string | null
  car_model: string | null
  current_status: JobStatus
  created_at: string
  updated_at: string
  scheduled_end: string | null
  customer: { full_name: string } | null
  service: { service_name: string } | null
  technician: { full_name: string } | null
}

interface FilterState {
  startDate: string
  endDate: string
  serviceId: string
  status: string
  technicianId: string
}

const STATUS_BADGE: Record<JobStatus, string> = {
  pending: "bg-amber-50 text-amber-600",
  ongoing: "bg-blue-50 text-blue-600",
  quality_check: "bg-orange-50 text-orange-500",
  completed: "bg-green-50 text-green-600",
  delayed: "bg-red-50 text-red-500",
  cancelled: "bg-gray-100 text-gray-500",
  released: "bg-teal-50 text-teal-600",
}

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending", ongoing: "Ongoing", quality_check: "Quality Check",
  completed: "Completed", delayed: "Delayed", cancelled: "Cancelled", released: "Released",
}

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30]

const today = new Date()
const firstOfYear = `${today.getFullYear()}-01-01`
const todayStr = today.toISOString().split("T")[0]

export default function JobOrderReport() {
  const supabase = createClient()

  const [filters, setFilters] = useState<FilterState>({
    startDate: firstOfYear, endDate: todayStr,
    serviceId: "all", status: "all", technicianId: "all",
  })
  const [applied, setApplied] = useState(filters)

  const [rows, setRows] = useState<JobRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [services, setServices] = useState<{ service_id: number; service_name: string }[]>([])
  const [technicians, setTechnicians] = useState<{ user_id: string; full_name: string }[]>([])

  useEffect(() => { loadDropdowns() }, [])
  useEffect(() => { setPage(1) }, [applied, pageSize])
  useEffect(() => { fetchData() }, [applied, page, pageSize])

  async function loadDropdowns() {
    const [{ data: svc }, { data: tech }] = await Promise.all([
      supabase.from("service").select("service_id, service_name").eq("is_archived", false).order("service_name"),
      supabase.from("profile").select("user_id, full_name").in("role", ["technician", "head_technician"]).eq("is_archived", false).order("full_name"),
    ])
    setServices(svc ?? [])
    setTechnicians(tech ?? [])
  }

  async function fetchData() {
    setLoading(true)
    const from = (page - 1) * pageSize

    let q = supabase
      .from("job_order")
      .select(
        `job_order_id, plate_number, car_make, car_model, current_status,
         created_at, updated_at, scheduled_end,
         customer:customer_id(full_name),
         service:service_id(service_name),
         technician:assigned_technician_id(full_name)`,
        { count: "exact" }
      )
      .gte("created_at", `${applied.startDate}T00:00:00Z`)
      .lte("created_at", `${applied.endDate}T23:59:59Z`)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1)

    if (applied.status !== "all") q = q.eq("current_status", applied.status)
    if (applied.serviceId !== "all") q = q.eq("service_id", Number(applied.serviceId))
    if (applied.technicianId !== "all") q = q.eq("assigned_technician_id", applied.technicianId)

    const { data, count, error } = await q
    if (!error) {
      setRows((data as unknown as JobRow[]) ?? [])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }

  function handleExportCSV() {
    const csvRows = rows.map((r) => ({
      "Job Order ID": formatJobId(r.job_order_id),
      "Customer Name": r.customer?.full_name ?? "—",
      Vehicle: r.plate_number ?? "—",
      "Service Type": r.service?.service_name ?? "—",
      Technician: r.technician?.full_name ?? "—",
      Status: STATUS_LABEL[r.current_status],
      "Date Created": formatDate(r.created_at),
      "Date Completed":
        r.current_status === "completed" || r.current_status === "released"
          ? formatDate(r.updated_at)
          : "—",
    }))
    exportToCSV(csvRows, "job-order-report.csv")
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const startLabel = new Date(applied.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const endLabel = new Date(applied.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 print:p-0">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400">
        <Link href="/dashboard/admin/reports" className="hover:text-gray-600 transition-colors">Reports</Link>
        <span className="mx-1.5">›</span>
        <span className="text-gray-600 font-medium">Job Order Reports</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-800">Job Order Reports</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
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
            <label className="text-xs font-medium text-gray-500">Service Type</label>
            <select value={filters.serviceId}
              onChange={(e) => setFilters((p) => ({ ...p, serviceId: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none bg-white">
              <option value="all">All</option>
              {services.map((s) => <option key={s.service_id} value={s.service_id}>{s.service_name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Job Status</label>
            <select value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none bg-white">
              <option value="all">All</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Technician</label>
            <select value={filters.technicianId}
              onChange={(e) => setFilters((p) => ({ ...p, technicianId: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none bg-white">
              <option value="all">All</option>
              {technicians.map((t) => <option key={t.user_id} value={t.user_id}>{t.full_name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setApplied(filters)}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
              Apply Filters
            </button>
            <button onClick={() => {
              const reset = { startDate: firstOfYear, endDate: todayStr, serviceId: "all", status: "all", technicianId: "all" }
              setFilters(reset); setApplied(reset)
            }} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Summary + Export */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {loading ? "Loading..." : (
            <>Showing <span className="font-semibold text-gray-800">{totalCount}</span> job orders from{" "}
              <span className="font-medium">{startLabel}</span> — <span className="font-medium">{endLabel}</span></>
          )}
        </p>
        <div className="flex gap-2 print:hidden">
          <button onClick={exportToPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <FileText className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <Table className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {["Job Order ID", "Customer Name", "Vehicle", "Service Type", "Technician", "Status", "Date Created", "Date Completed"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-gray-400">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-gray-400">No job orders found for this period.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.job_order_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3.5 font-medium text-gray-700">{formatJobId(r.job_order_id)}</td>
                <td className="px-4 py-3.5 font-medium text-gray-800">{r.customer?.full_name ?? "—"}</td>
                <td className="px-4 py-3.5 text-gray-500">{r.plate_number ?? "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.service?.service_name ?? "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.technician?.full_name ?? "—"}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.current_status]}`}>
                    {STATUS_LABEL[r.current_status]}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">
                  {r.current_status === "completed" || r.current_status === "released"
                    ? formatDate(r.updated_at) : "—"}
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
