"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, Filter, X } from "lucide-react"
import { JobManagementSkeleton } from "@/app/dashboard/job-management/loading"
import StatusPickerModal, {
  type JobStatus,
  type StatusOption,
  STATUS_BADGE_MAP,
} from "./StatusPickerModal"
import StatusConfirmDialog from "./StatusConfirmDialog"

interface JobOrder {
  id:            string
  displayId:     string
  customer:      string
  plate:         string
  vehicle:       string
  service:       string
  headDetailer:  string
  headInstaller: string
  scheduled:     string
  scheduledRaw:  string   // ISO — used for date-range filtering
  status:        JobStatus
  is_overdue:    boolean
}

type TabType = "All" | "Pending" | "Ongoing" | "For Rework" | "For Inspection" | "For Release" | "Delayed"
const TABS: TabType[] = ["All", "Pending", "Ongoing", "For Rework", "For Inspection", "For Release", "Delayed"]

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function JobManagementTable() {
  const router = useRouter()
  const [activeTab, setActiveTab]     = useState<TabType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [jobOrders, setJobOrders]     = useState<JobOrder[]>([])
  const [loading, setLoading]         = useState(true)
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const [currentPage]                 = useState(1)
  const pageSize = 15

  // Single-row picker modal state
  const [pickerJob, setPickerJob]         = useState<JobOrder | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<StatusOption | null>(null)
  const [updating, setUpdating]           = useState(false)
  const [updateError, setUpdateError]     = useState<string | null>(null)

  // Filter state
  const [filterOpen,       setFilterOpen]       = useState(false)
  const [filterService,    setFilterService]     = useState("")
  const [filterTechnician, setFilterTechnician]  = useState("")
  const [filterDateFrom,   setFilterDateFrom]    = useState("")
  const [filterDateTo,     setFilterDateTo]      = useState("")
  const filterRef = useRef<HTMLDivElement>(null)

  const hasActiveFilter = !!(filterService || filterTechnician || filterDateFrom || filterDateTo)

  function clearFilters() {
    setFilterService("")
    setFilterTechnician("")
    setFilterDateFrom("")
    setFilterDateTo("")
  }

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res  = await fetch("/api/operations/job-management/list-job-orders")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to fetch job orders")

      const mapped: JobOrder[] = (json.job_orders ?? []).map((r: any) => ({
        id:           r.id,
        displayId:    `JO-${new Date(r.created_at).getFullYear()}-${r.id.slice(-4).toUpperCase()}`,
        customer:     r.customer_name ?? "—",
        plate:        r.plate_number  ?? "—",
        vehicle:      r.vehicle_unit  ?? "—",
        service:      r.service       ?? "—",
        headDetailer:  r.head_detailer  ?? "Unassigned",
        headInstaller: r.head_installer ?? "Unassigned",
        scheduled:     fmtDate(r.scheduled_at),
        scheduledRaw: r.scheduled_at  ?? "",
        status:       (r.status as JobStatus) ?? "Pending",
        is_overdue:   r.is_overdue ?? false,
      }))

      setJobOrders(mapped)
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const uniqueServices    = useMemo(() => [...new Set(jobOrders.map((j) => j.service).filter((s) => s !== "—"))].sort(), [jobOrders])
  const uniqueTechnicians = useMemo(() => {
    const names = jobOrders.flatMap((j) => [j.headDetailer, j.headInstaller]).filter((t) => t !== "Unassigned")
    return [...new Set(names)].sort()
  }, [jobOrders])

  const filtered = useMemo(() => jobOrders.filter((job) => {
    const isDelayed  = job.status === "Delayed" || (job.is_overdue && (job.status === "Pending" || job.status === "Ongoing"))
    const matchesTab = activeTab === "All"
      || (activeTab === "Delayed" ? isDelayed : job.status === activeTab)
    const q             = searchQuery.toLowerCase()
    const matchesSearch = q === "" ||
      job.customer.toLowerCase().includes(q) ||
      job.displayId.toLowerCase().includes(q) ||
      job.plate.toLowerCase().includes(q) ||
      job.vehicle.toLowerCase().includes(q) ||
      job.service.toLowerCase().includes(q) ||
      job.headDetailer.toLowerCase().includes(q) ||
      job.headInstaller.toLowerCase().includes(q)
    const matchesService     = !filterService    || job.service === filterService
    const matchesTechnician  = !filterTechnician || job.headDetailer === filterTechnician || job.headInstaller === filterTechnician
    const jobDate            = job.scheduledRaw ? job.scheduledRaw.slice(0, 10) : ""
    const matchesDateFrom    = !filterDateFrom   || jobDate >= filterDateFrom
    const matchesDateTo      = !filterDateTo     || jobDate <= filterDateTo
    return matchesTab && matchesSearch && matchesService && matchesTechnician && matchesDateFrom && matchesDateTo
  }), [jobOrders, activeTab, searchQuery, filterService, filterTechnician, filterDateFrom, filterDateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function closeAll() {
    setPickerJob(null)
    setConfirmTarget(null)
    setUpdateError(null)
  }

  async function confirmUpdate(reason: string) {
    if (!confirmTarget || !pickerJob) return
    setUpdating(true)
    setUpdateError(null)
    try {
      const res  = await fetch(`/api/operations/job-orders/${pickerJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: confirmTarget.db, reason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to update status")
      setJobOrders((prev) =>
        prev.map((j) => j.id === pickerJob.id ? { ...j, status: confirmTarget.label } : j)
      )
      closeAll()
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : String(err))
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <JobManagementSkeleton />

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Job Order</h1>
          <Link
            href="/dashboard/job-management/add"
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            + Add Job Order
          </Link>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer, plate, vehicle, service, technician, or Job ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter button */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-lg font-medium transition-colors ${
                hasActiveFilter
                  ? "border-blue-400 bg-blue-50 text-blue-600"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filter
              {hasActiveFilter && (
                <span className="w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {[filterService, filterTechnician, filterDateFrom, filterDateTo].filter(Boolean).length}
                </span>
              )}
            </button>

            {filterOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-gray-100 rounded-xl shadow-lg z-20 p-4 space-y-4">
                {/* Service */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Service</p>
                  <select
                    aria-label="Filter Service"
                    value={filterService}
                    onChange={(e) => setFilterService(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Services</option>
                    {uniqueServices.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Head Technician */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Head Technician</p>
                  <select
                    aria-label="Filter Head Technician"
                    value={filterTechnician}
                    onChange={(e) => setFilterTechnician(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Technicians</option>
                    {uniqueTechnicians.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Date range */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Scheduled Date</p>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-6 shrink-0">From</span>
                      <input
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Filter Date From"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-6 shrink-0">To</span>
                      <input
                        aria-label="Date"
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {hasActiveFilter && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 w-full justify-center text-xs text-gray-400 hover:text-red-500 transition-colors pt-1"
                  >
                    <X className="w-3 h-3" /> Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
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
                {["Job Order ID", "Customer", "Vehicle", "Service", "Head Detailer", "Head Installer", "Scheduled", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
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
                    onClick={() => router.push(`/dashboard/job-management/${job.id}`)}
                    title="Click to view job details"
                    className={`border-b border-gray-50 transition-colors cursor-pointer hover:bg-blue-50/30 ${
                      idx === paginated.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/job-management/${job.id}`}
                        className="text-xs font-mono text-blue-600 hover:underline"
                      >
                        {job.displayId}
                      </Link>
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
                      <span className={`text-sm ${job.headDetailer === "Unassigned" ? "text-gray-400 italic" : "text-gray-700"}`}>{job.headDetailer}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${job.headInstaller === "Unassigned" ? "text-gray-400 italic" : "text-gray-700"}`}>{job.headInstaller}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">{job.scheduled}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_MAP[(job.is_overdue && (job.status === "Pending" || job.status === "Ongoing")) ? "Delayed" : job.status]}`}>
                        {(job.is_overdue && (job.status === "Pending" || job.status === "Ongoing")) ? "Delayed" : job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-gray-300 font-medium whitespace-nowrap">View details →</span>
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
            <select
              aria-label="Show Results"
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
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
          jobId={pickerJob.displayId}
          customerName={pickerJob.customer}
          currentStatus={pickerJob.status}
          onSelect={(opt) => setConfirmTarget(opt)}
          onClose={closeAll}
        />
      )}

      {/* Confirm Dialog */}
      {confirmTarget && (
        <StatusConfirmDialog
          customerName={pickerJob?.customer ?? ""}
          target={confirmTarget}
          error={updateError}
          updating={updating}
          onConfirm={confirmUpdate}
          onBack={() => setConfirmTarget(null)}
        />
      )}
    </>
  )
}
