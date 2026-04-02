"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Filter, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import AddServiceModal from "./AddServiceModal"

interface Service {
  service_id: number
  service_name: string
  description: string | null
  price: number
  estimated_duration_days: number | null
  is_archived: boolean
  stage_count: number
}

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30]

function truncate(text: string | null, max = 48) {
  if (!text) return "—"
  return text.length > max ? text.slice(0, max) + "..." : text
}

function formatPrice(amount: number) {
  return "₱" + amount.toLocaleString("en-PH")
}

function formatDuration(days: number | null) {
  if (!days) return "—"
  return days === 1 ? "1 day" : `${days} days`
}

export default function ServiceTable() {
  const supabase = createClient()

  const [services, setServices] = useState<Service[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all")
  const [filterOpen, setFilterOpen] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [actionMenu, setActionMenu] = useState<number | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

  const filterRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterOpen(false)
      if (actionRef.current && !actionRef.current.contains(e.target as Node))
        setActionMenu(null)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => { setPage(1) }, [search, statusFilter, pageSize])
  useEffect(() => { fetchServices() }, [search, statusFilter, page, pageSize])

  async function fetchServices() {
    setLoading(true)

    // Fetch stage counts for all services
    const { data: stageCounts } = await supabase
      .from("service_stage_template")
      .select("service_id")
      .eq("is_active", true)

    const countMap: Record<number, number> = {}
    for (const row of stageCounts ?? []) {
      countMap[row.service_id] = (countMap[row.service_id] ?? 0) + 1
    }

    let query = supabase
      .from("service")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })

    if (search.trim()) {
      query = query.ilike("service_name", `%${search.trim()}%`)
    }
    if (statusFilter === "active") query = query.eq("is_archived", false)
    else if (statusFilter === "archived") query = query.eq("is_archived", true)

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count, error } = await query

    if (!error) {
      const enriched = (data ?? []).map((s) => ({
        ...s,
        stage_count: countMap[s.service_id] ?? 0,
      })) as Service[]
      setServices(enriched)
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }

  async function handleArchiveToggle(service: Service) {
    setActionMenu(null)
    await supabase
      .from("service")
      .update({ is_archived: !service.is_archived })
      .eq("service_id", service.service_id)
    fetchServices()
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === services.length) setSelected(new Set())
    else setSelected(new Set(services.map((s) => s.service_id)))
  }

  const allSelected = services.length > 0 && selected.size === services.length

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-800">Service Management</h1>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white"
          />
        </div>

        {/* Filter */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-lg font-medium transition-colors ${
              statusFilter !== "all"
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>

          {filterOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-10 p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Status
              </p>
              {(["all", "active", "archived"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setFilterOpen(false) }}
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
          )}
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="ml-auto flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          + Add Service
        </button>
      </div>

      <AddServiceModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => fetchServices()}
      />

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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-56">
                Service Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Description
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                Price
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                Duration
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">
                Workflow Stages
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                Status
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-sm text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-sm text-gray-400">
                  No services found.
                </td>
              </tr>
            ) : (
              services.map((service) => (
                <tr
                  key={service.service_id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selected.has(service.service_id)}
                      onChange={() => toggleSelect(service.service_id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3.5 font-medium text-gray-800">
                    {service.service_name}
                  </td>
                  <td className="px-4 py-3.5 text-gray-400 max-w-xs">
                    {truncate(service.description)}
                  </td>
                  <td className="px-4 py-3.5 text-gray-700 font-medium">
                    {formatPrice(service.price)}
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">
                    {formatDuration(service.estimated_duration_days)}
                  </td>
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
                  <td className="px-4 py-3.5 relative">
                    <div ref={actionMenu === service.service_id ? actionRef : null}>
                      <button
                        onClick={() =>
                          setActionMenu((prev) =>
                            prev === service.service_id ? null : service.service_id
                          )
                        }
                        className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {actionMenu === service.service_id && (
                        <div className="absolute right-4 top-full mt-1 w-36 bg-white border border-gray-100 rounded-xl shadow-lg z-10 py-1">
                          <button
                            onClick={() => setActionMenu(null)}
                            className="w-full text-left text-sm px-3.5 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Edit
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
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
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
                      page === item
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
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
