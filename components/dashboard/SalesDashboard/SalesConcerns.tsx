"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Paperclip, ChevronLeft, ChevronRight, X, CheckCircle } from "lucide-react"
import type { ConcernRecord } from "@/components/dashboard/OperationComponents/ConcernDetailsDrawer"

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

// Read-only drawer — no resolve button, response note always shown as text
function ReadOnlyConcernDrawer({ record, onClose }: { record: ConcernRecord | null; onClose: () => void }) {
  const isOpen     = record !== null
  const isResolved = record?.status === "Resolved"

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        className={`fixed top-0 right-0 h-full w-[420px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-800">Concern Details</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {record && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Submitted By</p>
                <p className="text-sm font-semibold text-gray-800">{record.submitterName}</p>
                <p className="text-xs text-gray-400 capitalize">{record.submitterRole.replace("_", " ")}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Submitted</p>
                <p className="text-sm text-gray-700">{record.submitted_at}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Job Order</p>
                <p className="text-sm font-mono font-semibold text-gray-700">{record.jobId}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Title</p>
                <p className="text-sm font-semibold text-gray-800">{record.title}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">{record.description}</p>
              </div>

              {record.media.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    Attachments ({record.media.length})
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {record.media.map((m) =>
                      m.media_type === "photo" ? (
                        <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={m.file_url}
                            alt="concern attachment"
                            className="w-16 h-16 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ) : (
                        <a
                          key={m.id}
                          href={m.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          ▶ Video
                        </a>
                      )
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-400 mb-1.5">Response Note</p>
                <div className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 bg-gray-50 min-h-[72px]">
                  {record.response_note ?? <span className="text-gray-400 italic">No response yet.</span>}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              {isResolved ? (
                <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 text-green-600 text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Resolved
                </div>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-50 text-yellow-600 text-sm font-semibold">
                  Pending — awaiting operations response
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default function SalesConcerns() {
  const [records, setRecords]           = useState<ConcernRecord[]>([])
  const [loading, setLoading]           = useState(true)
  const [fetchError, setFetchError]     = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterType>("All")
  const [searchQuery, setSearchQuery]   = useState("")
  const [currentPage, setCurrentPage]   = useState(1)
  const [pageSize, setPageSize]         = useState(15)
  const [selected, setSelected]         = useState<ConcernRecord | null>(null)

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

  const filtered = records.filter((r) => {
    const matchFilter = activeFilter === "All" || r.status === activeFilter
    const q = searchQuery.toLowerCase()
    const matchSearch =
      q === "" ||
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
          <h1 className="text-xl font-bold text-gray-800">View Concerns</h1>
          <p className="text-sm text-gray-400 mt-0.5">Read-only reference view of submitted job concerns.</p>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by technician, job ID, or title…"
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
                {["Technician", "Job Order", "Title", "Description", "Attach.", "Submitted", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">Loading concerns…</td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-red-500">{fetchError}</td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No concerns found.</td>
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
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-semibold text-gray-600">{r.jobId}</span>
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
              aria-label="Next page"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ReadOnlyConcernDrawer record={selected} onClose={() => setSelected(null)} />
    </>
  )
}
