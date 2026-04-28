"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Paperclip, ChevronLeft, ChevronRight } from "lucide-react"
import ConcernDetailsDrawer, { type ConcernRecord } from "./ConcernDetailsDrawer"

type FilterType = "All" | "Pending" | "Resolved"
const FILTERS: FilterType[] = ["All", "Pending", "Resolved"]

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

function avatarColor(name: string): string {
  const palette = [
    "bg-blue-500", "bg-green-500", "bg-orange-400",
    "bg-purple-500", "bg-rose-500", "bg-teal-500",
  ]
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length
  return palette[idx]
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

export default function JobConcerns() {
  const [records, setRecords]         = useState<ConcernRecord[]>([])
  const [loading, setLoading]         = useState(true)
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize]       = useState(15)
  const [selected, setSelected]       = useState<ConcernRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res  = await fetch("/api/operations/job-concerns")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load concerns")

      const shaped: ConcernRecord[] = (json.concerns ?? []).map((c: any) => ({
        id:            c.id,
        title:         c.title,
        description:   c.description,
        status:        (c.status as "Pending" | "Resolved"),
        response_note: c.response_note ?? null,
        submitted_at:  fmtDate(c.submitted_at),
        jobId:         c.job?.id
          ? `JO-${new Date(c.submitted_at ?? "").getFullYear()}-${c.job.id.slice(-4).toUpperCase()}`
          : "—",
        submitterName: c.submitter?.full_name ?? "—",
        submitterRole: c.submitter?.role ?? "—",
        stage_name:    c.stage_name ?? null,
        media:         (c.media ?? []).map((m: any) => ({
          id:         m.id,
          file_url:   m.file_url,
          media_type: m.media_type,
        })),
      }))

      setRecords(shaped)
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleResolve(id: string, note: string) {
    setRecords((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: "Resolved", response_note: note } : r)
    )
    setSelected((prev) => prev?.id === id ? { ...prev, status: "Resolved", response_note: note } : prev)
  }

  const filtered = records.filter((r) => {
    const matchFilter = activeFilter === "All" || r.status === activeFilter
    const q = searchQuery.toLowerCase()
    const matchSearch = q === "" ||
      r.jobId.toLowerCase().includes(q) ||
      r.submitterName.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function changeFilter(f: FilterType) { setActiveFilter(f); setCurrentPage(1) }
  function changeSearch(v: string)     { setSearchQuery(v); setCurrentPage(1) }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Job Concerns</h1>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by technician or title..."
              value={searchQuery}
              onChange={(e) => changeSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => changeFilter(f)}
                className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                  activeFilter === f ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Technician", "Title", "Description", "Attach.", "Submitted", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                    Loading concerns…
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-red-500">
                    {fetchError}
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                    No concerns found.
                  </td>
                </tr>
              ) : (
                paginated.map((r, idx) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    title="Click to view concern details"
                    className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer ${
                      idx === paginated.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${avatarColor(r.submitterName)}`}>
                          {initials(r.submitterName)}
                        </div>
                        <div>
                          <p className="text-sm text-gray-700">{r.submitterName}</p>
                          <p className="text-xs text-gray-400 capitalize">{r.submitterRole.replace("_", " ")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-32">
                      <span className="text-sm font-medium text-gray-800 truncate block">{r.title}</span>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <span className="text-sm text-gray-600 truncate block">{r.description}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {r.media.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs text-gray-400">{r.media.length}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-400 whitespace-nowrap">{r.submitted_at}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {r.status === "Pending" ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                          Pending
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-green-600">Resolved</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
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
              aria-label="Select number of concerns to show per page"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label="Previous page"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                  page === currentPage ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              aria-label="Next Page"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ConcernDetailsDrawer
        record={selected}
        onClose={() => setSelected(null)}
        onResolve={handleResolve}
      />
    </>
  )
}
