"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search, Filter, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import AddServiceModal from "./AddServiceModal"
import EditServiceModal from "./EditServiceModal"
import AddServiceTypeModal from "./AddServiceTypeModal"

interface Service {
  id:                      string
  name:                    string
  service_type:            string | null
  description:             string | null
  estimated_duration_mins: number | null
  is_archived:             boolean
  stage_count:             number
}

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30]

function truncate(text: string | null, max = 48) {
  if (!text) return "—"
  return text.length > max ? text.slice(0, max) + "..." : text
}



function formatDuration(mins: number | null) {
  if (!mins) return "—"
  if (mins < 60)  return `${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return hours === 1 ? "1 hr" : `${hours} hrs`
  const days = Math.round(hours / 24)
  return days === 1 ? "1 day" : `${days} days`
}

export default function ServiceTable({ canWrite = true }: { canWrite?: boolean }) {
  const [services, setServices]   = useState<Service[]>([])
  const [totalCount, setTotal]    = useState(0)
  const [loading, setLoading]     = useState(true)
  const [fetchError, setError]    = useState<string | null>(null)

  const [searchInput, setSearchInput]   = useState("")
  const [search, setSearch]             = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all")
  const [durationMin, setDurationMin]   = useState("")
  const [durationMax, setDurationMax]   = useState("")
  const [filterOpen, setFilterOpen]     = useState(false)

  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [actionMenu, setActionMenu]     = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen]         = useState(false)
  const [addTypeModalOpen, setAddTypeModalOpen] = useState(false)
  const [editServiceId, setEditServiceId]       = useState<string | null>(null)

  const filterRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) setActionMenu(null)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Debounce search input — wait 300ms after last keystroke before firing API
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [search, statusFilter, durationMin, durationMax, pageSize])

  const fetchServices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        page:   String(page),
        limit:  String(pageSize),
      })
      const minMins = durationMin ? String(Number(durationMin) * 60) : ""
      const maxMins = durationMax ? String(Number(durationMax) * 60) : ""
      if (minMins) params.set("durationMin", minMins)
      if (maxMins) params.set("durationMax", maxMins)
      const res  = await fetch(`/api/operations/services?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load services")
      setServices(json.services ?? [])
      setTotal(json.total ?? 0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, durationMin, durationMax, page, pageSize])

  useEffect(() => { fetchServices() }, [fetchServices])


  async function handleArchiveToggle(service: Service) {
    setActionMenu(null)
    try {
      await fetch(`/api/operations/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: !service.is_archived }),
      })
      fetchServices()
    } catch {}
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === services.length) setSelected(new Set())
    else setSelected(new Set(services.map((s) => s.id)))
  }

  const allSelected = services.length > 0 && selected.size === services.length

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-800">Service Catalog</h1>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white"
          />
        </div>

        {/* Filter */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-lg font-medium transition-colors ${
              statusFilter !== "all" || durationMin || durationMax
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>

          {filterOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-56 bg-white border border-gray-100 rounded-xl shadow-lg z-10 p-3 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</p>
                {(["all", "active", "archived"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                      statusFilter === s
                        ? "bg-blue-50 text-blue-600 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-2 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration (hours)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Min"
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  />
                  <span className="text-gray-400 text-xs shrink-0">to</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="Max"
                    value={durationMax}
                    onChange={(e) => setDurationMax(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  />
                </div>
                {(durationMin || durationMax) && (
                  <button
                    onClick={() => { setDurationMin(""); setDurationMax("") }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Clear duration
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {canWrite && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setAddTypeModalOpen(true)}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              + Add Service Type
            </button>
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              + Add Service
            </button>
          </div>
        )}
      </div>

      {canWrite && (
        <>
          <AddServiceModal
            open={addModalOpen}
            onClose={() => setAddModalOpen(false)}
            onSuccess={() => fetchServices()}
          />
          <EditServiceModal
            serviceId={editServiceId}
            open={editServiceId !== null}
            onClose={() => setEditServiceId(null)}
            onSuccess={() => { setEditServiceId(null); fetchServices() }}
          />
          <AddServiceTypeModal
            open={addTypeModalOpen}
            onClose={() => setAddTypeModalOpen(false)}
            onSuccess={() => setAddTypeModalOpen(false)}
          />
        </>
      )}

      {fetchError && (
        <p className="text-sm text-red-500">{fetchError}</p>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">
                Service Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">
                Service Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Description
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">
                Est. Duration
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">
                Workflow Stages
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                Status
              </th>
              {canWrite && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canWrite ? 8 : 7} className="text-center py-12 text-sm text-gray-400">Loading...</td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 8 : 7} className="text-center py-12 text-sm text-gray-400">No services found.</td>
              </tr>
            ) : (
              services.map((service) => (
                <tr
                  key={service.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selected.has(service.id)}
                      onChange={() => toggleSelect(service.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    {service.service_type ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-teal-50 text-teal-700">
                        {service.service_type}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-gray-800">{service.name}</td>
                  <td className="px-4 py-3.5 text-gray-400 max-w-xs">{truncate(service.description)}</td>
                  <td className="px-4 py-3.5 text-gray-600">{formatDuration(service.estimated_duration_mins)}</td>
                  <td className="px-4 py-3.5">
                    {service.stage_count > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {service.stage_count} {service.stage_count === 1 ? "stage" : "stages"}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No stages</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {service.is_archived ? (
                      <span className="text-gray-400 text-sm">Archived</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">
                        Active
                      </span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3.5 relative">
                      <div ref={actionMenu === service.id ? actionRef : null}>
                        <button
                          onClick={() => setActionMenu((prev) => prev === service.id ? null : service.id)}
                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {actionMenu === service.id && (
                          <div className="absolute right-4 bottom-8 w-36 bg-white border border-gray-100 rounded-xl shadow-lg z-10 py-1">
                            <button
                              onClick={() => { setActionMenu(null); setEditServiceId(service.id) }}
                              className="w-full text-left text-sm px-3.5 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Edit Service
                            </button>
                            <button
                              onClick={() => handleArchiveToggle(service)}
                              className={`w-full text-left text-sm px-3.5 py-2 transition-colors ${
                                service.is_archived
                                  ? "text-green-600 hover:bg-green-50"
                                  : "text-red-500 hover:bg-red-50"
                              }`}
                            >
                              {service.is_archived ? "Unarchive" : "Archive"}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show Results:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<(number | "...")[]>((acc, n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("...")
                acc.push(n)
                return acc
              }, [])
              .map((item, idx) =>
                item === "..." ? (
                  <span key={`e-${idx}`} className="px-2 text-gray-400 text-sm">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === item ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
