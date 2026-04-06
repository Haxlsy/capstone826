"use client"

import React, { useState, useEffect } from "react"
import { Search, Info, Eye, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

type JobStatus = "Ongoing" | "Quality Check" | "Completed" | "Released" | "Delayed" | "Pending" | "Cancelled"

interface JobOrder {
  id: string
  customerName: string
  plate: string
  vehicleModel: string
  vehicleYear: string
  serviceType: string
  assignedTechnician: string
  status: JobStatus
  scheduledDate: string
  expectedCompletion: string
}

const DB_STATUS_MAP: Record<string, JobStatus> = {
  pending: "Pending",
  ongoing: "Ongoing",
  quality_check: "Quality Check",
  completed: "Completed",
  delayed: "Delayed",
  cancelled: "Cancelled",
  released: "Released",
}

function mapApiJob(r: any): JobOrder {
  const year = r.created_at ? new Date(r.created_at).getFullYear() : new Date().getFullYear()
  return {
    id: `JO-${year}-${String(r.job_order_id).padStart(3, "0")}`,
    customerName: r.customer?.full_name ?? "—",
    plate: r.plate_number ?? "—",
    vehicleModel: `${r.car_make ?? ""} ${r.car_model ?? ""}`.trim() || "—",
    vehicleYear: "",
    serviceType: r.service?.service_name ?? "—",
    assignedTechnician: r.assigned_technician?.full_name ?? "Unassigned",
    status: DB_STATUS_MAP[r.current_status] ?? "Pending",
    scheduledDate: r.scheduled_start
      ? new Date(r.scheduled_start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—",
    expectedCompletion: r.scheduled_end
      ? new Date(r.scheduled_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—",
  }
}

const ALL_STATUSES: JobStatus[] = ["Ongoing", "Quality Check", "Completed", "Released", "Delayed", "Pending", "Cancelled"]
const PAGE_SIZE_OPTIONS = [10, 15, 20]

const statusStyle: Record<JobStatus, string> = {
  "Ongoing":       "bg-blue-100 text-blue-600",
  "Quality Check": "bg-orange-100 text-orange-500",
  "Completed":     "bg-green-100 text-green-600",
  "Released":      "bg-teal-100 text-teal-600",
  "Delayed":       "bg-red-100 text-red-500",
  "Pending":       "bg-yellow-100 text-yellow-600",
  "Cancelled":     "bg-gray-100 text-gray-400",
}

export default React.memo(function JobOrderStatus() {
  const [jobs, setJobs]               = useState<JobOrder[]>([])
  const [loading, setLoading]         = useState(true)
  const [technicians, setTechnicians] = useState<string[]>([])
  const [search, setSearch]           = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [techFilter, setTechFilter]   = useState("All")
  const [dateFilter, setDateFilter]   = useState("")
  const [pageSize, setPageSize]       = useState(15)
  const [page, setPage]               = useState(1)

  useEffect(() => {
    const abortController = new AbortController()
    
    async function load() {
      setLoading(true)
      try {
        const res = await fetch("/api/sales/job-orders", {
          signal: abortController.signal
        })
        const json = await res.json()
        if (res.ok) {
          const mapped: JobOrder[] = (json.job_orders ?? []).map(mapApiJob)
          setJobs(mapped)
          const techNames = [...new Set(mapped.map((j) => j.assignedTechnician).filter((t) => t !== "Unassigned"))]
          setTechnicians(techNames)
        }
      } catch (err: any) {
        // ignore abort errors (component unmounted)
        if (err?.name !== "AbortError") {
          // leave empty for other errors
        }
      } finally {
        setLoading(false)
      }
    }
    load()
    
    return () => abortController.abort()
  }, [])

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase()
    const matchSearch =
      j.customerName.toLowerCase().includes(q) ||
      j.plate.toLowerCase().includes(q) ||
      j.id.toLowerCase().includes(q)
    const matchStatus = statusFilter === "All" || j.status === statusFilter
    const matchTech   = techFilter === "All"   || j.assignedTechnician === techFilter
    return matchSearch && matchStatus && matchTech
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Job Order Status</h1>
        <p className="text-sm text-gray-400 mt-1">
          Look up current job status to respond to customer inquiries. Read-only access.
        </p>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-lg mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by customer name, plate number, or job order ID..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer"
          >
            <option value="All">All</option>
            {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* Technician filter */}
        <div className="relative">
          <select
            value={techFilter}
            onChange={(e) => { setTechFilter(e.target.value); setPage(1) }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer"
          >
            <option value="All">All</option>
            {technicians.map((t) => <option key={t}>{t}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* Date range (visual) */}
        <input
          type="text"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          placeholder="Date range"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-36"
        />
      </div>

      {/* Read-only notice */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 mb-4">
        <Info className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm text-blue-600">
          This view is read-only. Job orders are managed by Operations.
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {[
                "JOB ORDER ID",
                "CUSTOMER NAME",
                "VEHICLE",
                "SERVICE TYPE",
                "ASSIGNED TECHNICIAN",
                "STATUS",
                "SCHEDULED DATE",
                "EXPECTED COMPLETION",
                "",
              ].map((col) => (
                <th
                  key={col}
                  className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-sm text-gray-400">Loading...</td>
              </tr>
            ) : null}
            {!loading && paginated.map((j) => (
              <tr key={j.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3.5 font-mono text-xs text-blue-500">{j.id}</td>
                <td className="px-4 py-3.5 font-semibold text-gray-800">{j.customerName}</td>
                <td className="px-4 py-3.5">
                  <div className="font-medium text-gray-800">{j.plate}</div>
                  <div className="text-xs text-gray-400">{j.vehicleModel} {j.vehicleYear}</div>
                </td>
                <td className="px-4 py-3.5 text-gray-700">{j.serviceType}</td>
                <td className="px-4 py-3.5 text-gray-700">{j.assignedTechnician}</td>
                <td className="px-4 py-3.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle[j.status]}`}>
                    {j.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-gray-600">{j.scheduledDate}</td>
                <td className="px-4 py-3.5 text-gray-600">{j.expectedCompletion}</td>
                <td className="px-4 py-3.5">
                  <button className="text-gray-300 hover:text-gray-500 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && paginated.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-10 text-sm text-gray-400">
                  No job orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Show Results:</span>
          <div className="relative">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="appearance-none pl-3 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n}>{n}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                page === n ? "bg-gray-900 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
})
