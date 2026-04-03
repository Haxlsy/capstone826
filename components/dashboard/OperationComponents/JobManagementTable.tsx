"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Filter, MoreHorizontal } from "lucide-react"

type JobStatus =
  | "Pending"
  | "Ongoing"
  | "Quality Check"
  | "Completed"
  | "Delayed"
  | "Released"
  | "Cancelled"

interface JobOrder {
  id: string
  customer: string
  plate: string
  vehicle: string
  service: string
  technician: string
  scheduled: string
  status: JobStatus
}

const jobOrdersInitial: JobOrder[] = []

const statusBadgeMap: Record<JobStatus, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Ongoing: "bg-blue-100 text-blue-700",
  "Quality Check": "bg-orange-100 text-orange-700",
  Completed: "bg-green-100 text-green-700",
  Delayed: "bg-red-100 text-red-700",
  Released: "bg-teal-100 text-teal-700",
  Cancelled: "bg-gray-100 text-gray-500",
}

type TabType = "All" | "Pending" | "Ongoing" | "Quality Check" | "Completed" | "Delayed" | "Released"

const TABS: TabType[] = ["All", "Pending", "Ongoing", "Quality Check", "Completed", "Delayed", "Released"]

export default function JobManagementTable() {
  const [activeTab, setActiveTab] = useState<TabType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [jobOrders, setJobOrders] = useState<JobOrder[]>(jobOrdersInitial)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [currentPage] = useState(1)
  const pageSize = 15

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setFetchError(null)
      try {
        const res = await fetch("/api/operations/Job%20Management/list-job-orders")
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error ?? "Failed to fetch job orders")

        const mapped: JobOrder[] = (json.job_orders || []).map((r: any) => {
          const id = `JO-${new Date(r.created_at).getFullYear()}-${String(r.job_order_id).padStart(3, "0")}`
          const customer = r.customer?.full_name ?? `Customer #${r.customer?.customer_id ?? r.customer_id ?? "-"}`
          const plate = r.plate_number ?? "—"
          const vehicle = `${r.car_make ?? ""} ${r.car_model ?? ""}`.trim()
          const service = r.service?.service_name ?? "—"
          const technician = r.assigned_technician?.full_name ?? "Unassigned"
          const scheduled = r.scheduled_start ? new Date(r.scheduled_start).toLocaleDateString() : "—"
          const statusMap: Record<string, JobStatus> = {
            pending: "Pending",
            ongoing: "Ongoing",
            quality_check: "Quality Check",
            completed: "Completed",
            delayed: "Delayed",
            released: "Released",
            cancelled: "Cancelled",
          }
          const status = statusMap[r.current_status] ?? (r.current_status as JobStatus) ?? "Pending"

          return { id, customer, plate, vehicle, service, technician, scheduled, status }
        })

        if (mounted) setJobOrders(mapped)
      } catch (err: any) {
        if (mounted) setFetchError(err?.message ?? String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const filtered = jobOrders.filter((job) => {
    const matchesTab = activeTab === "All" || job.status === activeTab
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      q === "" ||
      job.customer.toLowerCase().includes(q) ||
      job.id.toLowerCase().includes(q)
    return matchesTab && matchesSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Job Management</h1>
        <Link
          href="/dashboard/job-management/add"
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          + Add Job Order
        </Link>
      </div>

      {/* Search + Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? "text-blue-600 border-b-2 border-blue-500 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Job Order ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Vehicle
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Service
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Technician
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Scheduled
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                  Loading job orders…
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                  {fetchError ? `Error: ${fetchError}` : "No job orders found."}
                </td>
              </tr>
            ) : (
              paginated.map((job, idx) => (
                <tr
                  key={job.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    idx === paginated.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 font-mono">{job.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-800">{job.customer}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-blue-500">{job.plate}</span>
                    <span className="text-xs text-gray-400"> — {job.vehicle}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{job.service}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{job.technician}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">{job.scheduled}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        statusBadgeMap[job.status]
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Show Results:</span>
          <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors text-sm disabled:opacity-40">
            &lt;
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                page === currentPage
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {page}
            </button>
          ))}
          <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors text-sm disabled:opacity-40">
            &gt;
          </button>
        </div>
      </div>
    </div>
  )
}
