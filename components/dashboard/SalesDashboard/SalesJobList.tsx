"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Filter, X, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"

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
  scheduledRaw:  string
  status:        string
}

type TabType = "All" | "Pending" | "Ongoing" | "For Rework" | "For Release" | "Delayed" | "Cancelled"
const TABS: TabType[] = ["All", "Pending", "Ongoing", "For Rework", "For Release", "Delayed", "Cancelled"]

const STATUS_BADGE: Record<string, string> = {
  Pending:        "bg-yellow-50 text-yellow-700 border-yellow-100",
  Ongoing:        "bg-blue-50 text-blue-700 border-blue-100",
  "For Rework":   "bg-orange-50 text-orange-700 border-orange-100",
  "For Release":  "bg-purple-50 text-purple-700 border-purple-100",
  Released:       "bg-emerald-50 text-emerald-700 border-emerald-100",
  Delayed:        "bg-red-50 text-red-700 border-red-100",
  Cancelled:      "bg-gray-100 text-gray-500 border-gray-200",
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const PAGE_SIZE = 15

export default function SalesJobList() {
  const router = useRouter()
  const [jobOrders, setJobOrders]     = useState<JobOrder[]>([])
  const [loading, setLoading]         = useState(false)
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const [activeTab, setActiveTab]     = useState<TabType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const [filterOpen,       setFilterOpen]       = useState(false)
  const [filterService,    setFilterService]     = useState("")
  const [filterTechnician, setFilterTechnician]  = useState("")
  const [filterDateFrom,   setFilterDateFrom]    = useState("")
  const [filterDateTo,     setFilterDateTo]      = useState("")
  const filterRef = useRef<HTMLDivElement>(null)

  const hasActiveFilter = !!(filterService || filterTechnician || filterDateFrom || filterDateTo)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res  = await fetch("/api/operations/job-management/list-job-orders")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to fetch job orders")

      const mapped: JobOrder[] = (json.job_orders ?? []).map((r: any) => ({
        id:            r.id,
        displayId:     `JO-${new Date(r.created_at).getFullYear()}-${r.id.slice(-4).toUpperCase()}`,
        customer:      r.customer_name ?? "—",
        plate:         r.plate_number  ?? "—",
        vehicle:       r.vehicle_unit  ?? "—",
        service:       r.service       ?? "—",
        headDetailer:  r.head_detailer  ?? "Unassigned",
        headInstaller: r.head_installer ?? "Unassigned",
        scheduled:     fmtDate(r.scheduled_at),
        scheduledRaw:  r.scheduled_at  ?? "",
        status:        r.status        ?? "Pending",
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

  const filtered = jobOrders.filter((j) => {
    if (activeTab !== "All" && j.status !== activeTab) return false
    const q = searchQuery.toLowerCase()
    if (q && !`${j.customer} ${j.displayId} ${j.plate} ${j.vehicle} ${j.service} ${j.headDetailer} ${j.headInstaller}`.toLowerCase().includes(q)) return false
    if (filterService    && !j.service.toLowerCase().includes(filterService.toLowerCase())) return false
    if (filterTechnician && ![j.headDetailer, j.headInstaller].join(" ").toLowerCase().includes(filterTechnician.toLowerCase())) return false
    if (filterDateFrom && j.scheduledRaw && j.scheduledRaw < filterDateFrom) return false
    if (filterDateTo   && j.scheduledRaw && j.scheduledRaw > filterDateTo + "T23:59:59") return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function changeTab(t: TabType) { setActiveTab(t); setCurrentPage(1) }
  function changeSearch(v: string) { setSearchQuery(v); setCurrentPage(1) }

  const tabCounts: Record<string, number> = { All: jobOrders.length }
  for (const j of jobOrders) tabCounts[j.status] = (tabCounts[j.status] ?? 0) + 1

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">View Job Orders</h1>
        <p className="text-sm text-gray-400 mt-0.5">Read-only reference view of all active job orders.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto overflow-y-hidden">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => changeTab(t)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === t
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t}
            {tabCounts[t] ? (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === t ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
              }`}>
                {tabCounts[t]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customer, job ID, plate, service…"
            value={searchQuery}
            onChange={(e) => changeSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
              hasActiveFilter
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {hasActiveFilter && (
              <span className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold">
                {[filterService, filterTechnician, filterDateFrom, filterDateTo].filter(Boolean).length}
              </span>
            )}
          </button>

          {filterOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-100 rounded-xl shadow-lg z-20 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Filters</p>
                {hasActiveFilter && (
                  <button
                    onClick={() => { setFilterService(""); setFilterTechnician(""); setFilterDateFrom(""); setFilterDateTo("") }}
                    className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Service</label>
                <input type="text" value={filterService} onChange={(e) => setFilterService(e.target.value)} placeholder="e.g. Ceramic Coating" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Technician</label>
                <input type="text" value={filterTechnician} onChange={(e) => setFilterTechnician(e.target.value)} placeholder="Name" className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Scheduled From</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Scheduled To</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Job ID", "Customer", "Plate", "Vehicle", "Service", "Head Detailer", "Head Installer", "Scheduled", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">Loading job orders…</td></tr>
            ) : fetchError ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-red-500">{fetchError}</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">No job orders found.</td></tr>
            ) : (
              paginated.map((j, idx) => (
                <tr
                  key={j.id}
                  onClick={() => router.push(`/dashboard/sales/jobs/${j.id}`)}
                  className={`border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors group ${idx === paginated.length - 1 ? "border-b-0" : ""}`}
                >
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs font-semibold text-gray-700">{j.displayId}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-gray-800 font-medium">{j.customer}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-gray-600">{j.plate}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-gray-600 max-w-28 truncate block">{j.vehicle}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-gray-700 max-w-36 truncate block">{j.service}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-gray-500">{j.headDetailer}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-gray-500">{j.headInstaller}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{j.scheduled}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_BADGE[j.status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 w-8">
                    <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Showing {paginated.length} of {filtered.length} jobs
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                p === currentPage ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
