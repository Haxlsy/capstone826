"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Filter, X, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import { fmtDate } from "@/lib/time-display"

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
  Pending:        "bg-status-warning/12 text-status-warning border-status-warning/30",
  Ongoing:        "bg-primary/10 text-primary border-primary/20",
  "For Rework":   "bg-status-rework/10 text-status-rework border-orange-100",
  "For Release":  "bg-status-concern/12 text-status-concern border-purple-100",
  Released:       "bg-status-inspection/12 text-status-inspection border-status-inspection/30",
  Delayed:        "bg-status-delayed/10 text-status-delayed border-status-delayed/30",
  Cancelled:      "bg-surface-muted text-body border-border",
}

const PAGE_SIZE = 15

export default function SalesJobList({ jobOrders: rawOrders }: { jobOrders: any[] }) {
  const router = useRouter()
  const jobOrders = useMemo(() =>
    rawOrders.map((r: any): JobOrder => ({
      id: r.id,
      displayId: `JO-${new Date(r.created_at).getFullYear()}-${r.id.slice(-4).toUpperCase()}`,
      customer: r.customer_name ?? "—",
      plate: r.plate_number ?? "—",
      vehicle: r.vehicle_unit ?? "—",
      service: r.service ?? "—",
      headDetailer: r.head_detailer ?? "Unassigned",
      headInstaller: r.head_installer ?? "Unassigned",
      scheduled: fmtDate(r.scheduled_at),
      scheduledRaw: r.scheduled_at ?? "",
      status: r.status ?? "Pending",
    })),
  [rawOrders])

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
        <h1 className="text-xl font-bold text-heading">View Job Orders</h1>
        <p className="text-sm text-muted mt-0.5">Read-only reference view of all active job orders.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-subtle overflow-x-auto overflow-y-hidden">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => changeTab(t)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-body"
            }`}
          >
            {t}
            {tabCounts[t] ? (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === t ? "bg-primary text-white" : "bg-surface-muted text-body"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search customer, job ID, plate, service…"
            value={searchQuery}
            onChange={(e) => changeSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-sm transition-colors ${
              hasActiveFilter
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-body hover:bg-surface-muted"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {hasActiveFilter && (
              <span className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">
                {[filterService, filterTechnician, filterDateFrom, filterDateTo].filter(Boolean).length}
              </span>
            )}
          </button>

          {filterOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-surface border border-border-subtle rounded-card shadow-pop z-20 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-body uppercase tracking-wide">Filters</p>
                {hasActiveFilter && (
                  <button
                    onClick={() => { setFilterService(""); setFilterTechnician(""); setFilterDateFrom(""); setFilterDateTo("") }}
                    className="text-xs text-primary hover:text-primary flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-body">Service</label>
                <input type="text" value={filterService} onChange={(e) => setFilterService(e.target.value)} placeholder="e.g. Ceramic Coating" className="border border-border rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-body">Technician</label>
                <input type="text" value={filterTechnician} onChange={(e) => setFilterTechnician(e.target.value)} placeholder="Name" className="border border-border rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-body">Scheduled From</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="border border-border rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-body">Scheduled To</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="border border-border rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-card border border-border-subtle overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-subtle">
              {["Job ID", "Customer", "Plate", "Vehicle", "Service", "Head Detailer", "Head Installer", "Scheduled", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
            <tbody>
              {paginated.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">No job orders found.</td></tr>
            ) : (
              paginated.map((j, idx) => (
                <tr
                  key={j.id}
                  onClick={() => router.push(`/dashboard/sales/jobs/${j.id}`)}
                  className={`border-b border-border-subtle hover:bg-primary/5 cursor-pointer transition-colors group ${idx === paginated.length - 1 ? "border-b-0" : ""}`}
                >
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs font-semibold text-body">{j.displayId}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-heading font-medium">{j.customer}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-body">{j.plate}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-body max-w-28 truncate block">{j.vehicle}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-body max-w-36 truncate block">{j.service}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-body">{j.headDetailer}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-body">{j.headInstaller}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-muted whitespace-nowrap">{j.scheduled}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_BADGE[j.status] ?? "bg-surface-muted text-body border-border"}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 w-8">
                    <ArrowRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Showing {paginated.length} of {filtered.length} jobs
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-md text-body hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                p === currentPage ? "bg-primary text-white" : "text-body hover:bg-surface-muted"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-md text-body hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
