"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { Search, Filter, MoreHorizontal, ChevronRight } from "lucide-react"
import StatusPickerModal, {
  type JobStatus,
  type StatusOption,
  STATUS_BADGE_MAP,
} from "./StatusPickerModal"
import StatusConfirmDialog from "./StatusConfirmDialog"
import BulkStatusButton from "./BulkStatusButton"

interface JobOrder {
  rawId: number
  id: string
  customer: string
  plate: string
  vehicle: string
  service: string
  technician: string
  scheduled: string
  status: JobStatus
}

const DB_STATUS_MAP: Record<string, JobStatus> = {
  pending:       "Pending",
  ongoing:       "Ongoing",
  quality_check: "Quality Check",
  completed:     "Completed",
  delayed:       "Delayed",
  released:      "Released",
  cancelled:     "Cancelled",
}

type TabType = "All" | "Pending" | "Ongoing" | "Quality Check" | "Completed" | "Delayed" | "Released"
const TABS: TabType[] = ["All", "Pending", "Ongoing", "Quality Check", "Completed", "Delayed", "Released"]

export default function JobManagementTable() {
  const [activeTab, setActiveTab]     = useState<TabType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [jobOrders, setJobOrders]     = useState<JobOrder[]>([])
  const [loading, setLoading]         = useState(false)
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const [currentPage]                 = useState(1)
  const pageSize = 15

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Single-row picker modal state
  const [pickerJob, setPickerJob]         = useState<JobOrder | null>(null)

  // Shared confirm state (used for both single and bulk)
  const [confirmTarget, setConfirmTarget] = useState<StatusOption | null>(null)
  const [isBulkMode, setIsBulkMode]       = useState(false)
  const [updating, setUpdating]           = useState(false)
  const [updateError, setUpdateError]     = useState<string | null>(null)

  // Bulk picker state
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res  = await fetch("/api/operations/job-management/list-job-orders")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to fetch job orders")

      const mapped: JobOrder[] = (json.job_orders || []).map((r: any) => ({
        rawId:      r.job_order_id,
        id:         `JO-${new Date(r.created_at).getFullYear()}-${String(r.job_order_id).padStart(3, "0")}`,
        customer:   r.customer?.full_name ?? `Customer #${r.customer_id ?? "-"}`,
        plate:      r.plate_number ?? "—",
        vehicle:    `${r.car_make ?? ""} ${r.car_model ?? ""}`.trim() || "—",
        service:    r.service?.service_name ?? "—",
        technician: r.assigned_technician?.full_name ?? "Unassigned",
        scheduled:  r.scheduled_start ? new Date(r.scheduled_start).toLocaleDateString() : "—",
        status:     DB_STATUS_MAP[r.current_status] ?? "Pending",
      }))

      setJobOrders(mapped)
    } catch (err: any) {
      setFetchError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Derived filter/pagination
  const filtered = useMemo(() => jobOrders.filter((job) => {
    const matchesTab    = activeTab === "All" || job.status === activeTab
    const q             = searchQuery.toLowerCase()
    const matchesSearch = q === "" || job.customer.toLowerCase().includes(q) || job.id.toLowerCase().includes(q)
    return matchesTab && matchesSearch
  }), [jobOrders, activeTab, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Selection helpers
  const paginatedIds     = paginated.map((j) => j.rawId)
  const allPageSelected  = paginatedIds.length > 0 && paginatedIds.every((id) => selectedIds.has(id))
  const somePageSelected = paginatedIds.some((id) => selectedIds.has(id))

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        paginatedIds.forEach((id) => next.delete(id))
      } else {
        paginatedIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function toggleRow(rawId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(rawId) ? next.delete(rawId) : next.add(rawId)
      return next
    })
  }

  // Derive common status from selected rows
  const selectedJobs   = jobOrders.filter((j) => selectedIds.has(j.rawId))
  const uniqueStatuses = [...new Set(selectedJobs.map((j) => j.status))]
  const allSameStatus  = uniqueStatuses.length === 1
  const commonStatus   = allSameStatus ? uniqueStatuses[0] : null

  // ── Single-row picker ──
  function openSinglePicker(job: JobOrder) {
    setPickerJob(job)
    setIsBulkMode(false)
    setConfirmTarget(null)
    setUpdateError(null)
  }

  // ── Bulk picker ──
  function openBulkPicker() {
    setBulkPickerOpen(true)
    setIsBulkMode(true)
    setConfirmTarget(null)
    setUpdateError(null)
  }

  function closeAll() {
    setPickerJob(null)
    setBulkPickerOpen(false)
    setIsBulkMode(false)
    setConfirmTarget(null)
    setUpdateError(null)
  }

  // ── Confirm handler (single + bulk) ──
  async function confirmUpdate() {
    if (!confirmTarget) return
    setUpdating(true)
    setUpdateError(null)
    try {
      if (isBulkMode) {
        const ids = [...selectedIds]
        await Promise.all(
          ids.map((rawId) =>
            fetch(`/api/operations/job-orders/${rawId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: confirmTarget.db }),
            })
          )
        )
        setJobOrders((prev) =>
          prev.map((j) => selectedIds.has(j.rawId) ? { ...j, status: confirmTarget.label } : j)
        )
        setSelectedIds(new Set())
      } else {
        if (!pickerJob) return
        const res  = await fetch(`/api/operations/job-orders/${pickerJob.rawId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: confirmTarget.db }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error ?? "Failed to update status")
        setJobOrders((prev) =>
          prev.map((j) => j.rawId === pickerJob.rawId ? { ...j, status: confirmTarget.label } : j)
        )
      }
      closeAll()
    } catch (err: any) {
      setUpdateError(err?.message ?? String(err))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Job Management</h1>
          <div className="flex items-center gap-3">
            <BulkStatusButton
              count={selectedIds.size}
              allSameStatus={allSameStatus}
              onClick={openBulkPicker}
            />
            <Link
              href="/dashboard/job-management/add"
              className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              + Add Job Order
            </Link>
          </div>
        </div>

        {/* Search + Filter */}
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
              onClick={() => { setActiveTab(tab); setSelectedIds(new Set()) }}
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
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                    onChange={toggleSelectAll}
                  />
                </th>
                {["Job Order ID", "Customer", "Vehicle", "Service", "Technician", "Scheduled", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
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
                paginated.map((job, idx) => {
                  const isSelected = selectedIds.has(job.rawId)
                  return (
                    <tr
                      key={job.id}
                      className={`border-b border-gray-50 transition-colors ${
                        idx === paginated.length - 1 ? "border-b-0" : ""
                      } ${isSelected ? "bg-blue-50/60" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleRow(job.rawId)}
                        />
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
                        <button
                          onClick={() => openSinglePicker(job)}
                          title="Click to update status"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 active:scale-95 transition-all ${STATUS_BADGE_MAP[job.status]}`}
                        >
                          {job.status}
                          <ChevronRight className="w-3 h-3 opacity-60" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-gray-400 hover:text-gray-600 transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
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

      {/* Single-row Status Picker */}
      {pickerJob && !confirmTarget && (
        <StatusPickerModal
          jobId={pickerJob.id}
          customerName={pickerJob.customer}
          currentStatus={pickerJob.status}
          onSelect={(opt) => setConfirmTarget(opt)}
          onClose={closeAll}
        />
      )}

      {/* Bulk Status Picker */}
      {bulkPickerOpen && commonStatus && !confirmTarget && (
        <StatusPickerModal
          jobId={`${selectedIds.size} jobs selected`}
          customerName={`${selectedIds.size} selected job${selectedIds.size > 1 ? "s" : ""}`}
          currentStatus={commonStatus}
          onSelect={(opt) => setConfirmTarget(opt)}
          onClose={closeAll}
        />
      )}

      {/* Confirm Dialog (single + bulk) */}
      {confirmTarget && (
        <StatusConfirmDialog
          customerName={isBulkMode
            ? `${selectedIds.size} selected job${selectedIds.size > 1 ? "s" : ""}`
            : (pickerJob?.customer ?? "")}
          target={confirmTarget}
          error={updateError}
          updating={updating}
          count={isBulkMode ? selectedIds.size : undefined}
          onConfirm={confirmUpdate}
          onBack={() => setConfirmTarget(null)}
        />
      )}
    </>
  )
}
