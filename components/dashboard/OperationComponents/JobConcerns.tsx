"use client"

import { useState } from "react"
import { Search, Filter, Paperclip, ChevronLeft, ChevronRight } from "lucide-react"
import ConcernDetailsDrawer, { type ConcernRecordFull } from "./ConcernDetailsDrawer"

type ConcernStatus = "Unresolved" | "Resolved"
type FilterType = "All" | "Unresolved" | "Resolved"
type ConcernType = "Material Issue" | "Equipment" | "Rework Needed"

type ConcernRecord = ConcernRecordFull

const concernRecords: ConcernRecord[] = [
  {
    jobId: "JO-2026-008",
    techInitials: "MS",
    techName: "Mark Santos",
    techColor: "bg-green-500",
    concernType: "Material Issue",
    description: "The PPF material has visible defects on the surface...",
    attachments: 2,
    submitted: "Apr 1, 2026, 9:15 AM",
    status: "Unresolved",
  },
  {
    jobId: "JO-2026-005",
    techInitials: "PL",
    techName: "Pedro Lim",
    techColor: "bg-blue-500",
    concernType: "Equipment",
    description: "Heat gun stopped working during film application...",
    attachments: 1,
    submitted: "Apr 1, 2026, 8:30 AM",
    status: "Unresolved",
  },
  {
    jobId: "JO-2026-003",
    techInitials: "RA",
    techName: "Rosa Aquino",
    techColor: "bg-orange-400",
    concernType: "Rework Needed",
    description: "Customer reported bubbling on the rear window tint...",
    attachments: 3,
    submitted: "Mar 31, 2026, 3:45 PM",
    status: "Unresolved",
  },
  {
    jobId: "JO-2026-010",
    techInitials: "DC",
    techName: "David Cruz",
    techColor: "bg-gray-500",
    concernType: "Material Issue",
    description: "Ran out of ceramic coating solution mid-application...",
    attachments: 0,
    submitted: "Mar 31, 2026, 11:00 AM",
    status: "Resolved",
  },
  {
    jobId: "JO-2026-007",
    techInitials: "MS",
    techName: "Mark Santos",
    techColor: "bg-green-500",
    concernType: "Equipment",
    description: "Pressure washer needs maintenance, low pressure output...",
    attachments: 1,
    submitted: "Mar 30, 2026, 2:00 PM",
    status: "Resolved",
  },
  {
    jobId: "JO-2026-002",
    techInitials: "PL",
    techName: "Pedro Lim",
    techColor: "bg-blue-500",
    concernType: "Rework Needed",
    description: "Minor scratches found during final inspection of hood area...",
    attachments: 2,
    submitted: "Mar 29, 2026, 10:30 AM",
    status: "Resolved",
  },
]

const concernTypeBadgeMap: Record<ConcernType, string> = {
  "Material Issue": "bg-red-100 text-red-600",
  Equipment: "bg-orange-100 text-orange-600",
  "Rework Needed": "bg-purple-100 text-purple-600",
}

const FILTERS: FilterType[] = ["All", "Unresolved", "Resolved"]

export default function JobConcerns() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [records, setRecords] = useState<ConcernRecord[]>(concernRecords)
  const [selectedRecord, setSelectedRecord] = useState<ConcernRecord | null>(null)

  function handleResolve(jobId: string, note: string) {
    setRecords((prev) =>
      prev.map((r) => (r.jobId === jobId ? { ...r, status: "Resolved" as ConcernStatus } : r))
    )
    if (selectedRecord?.jobId === jobId) {
      setSelectedRecord((prev) => prev ? { ...prev, status: "Resolved" } : prev)
    }
  }

  const filtered = records.filter((record) => {
    const matchesFilter = activeFilter === "All" || record.status === activeFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      q === "" ||
      record.jobId.toLowerCase().includes(q) ||
      record.techName.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter)
    setCurrentPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  return (
    <>
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Job Concerns</h1>
      </div>

      {/* Search + Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search concerns..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Toggle group */}
        <div className="flex items-center gap-1">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => handleFilterChange(filter)}
              className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                activeFilter === filter
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Job Order ID
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Technician
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Concern Type
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Description
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Attach.
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Submitted
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Status
              </th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                  No concerns found.
                </td>
              </tr>
            ) : (
              paginated.map((record, idx) => (
                <tr
                  key={`${record.jobId}-${idx}`}
                  className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                    idx === paginated.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-mono text-gray-500">{record.jobId}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${record.techColor}`}
                      >
                        {record.techInitials}
                      </div>
                      <span className="text-sm text-gray-700">{record.techName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${concernTypeBadgeMap[record.concernType]}`}
                    >
                      {record.concernType}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 max-w-xs">
                    <span className="text-sm text-gray-600 truncate block">{record.description}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {record.attachments > 0 ? (
                      <div className="flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-400">{record.attachments}</span>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{record.submitted}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {record.status === "Unresolved" ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-600">
                        Unresolved
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-green-600">Resolved</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium cursor-pointer transition-colors"
                    >
                      View
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
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
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
                page === currentPage
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {page}
            </button>
          ))}
          <button
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
      record={selectedRecord}
      onClose={() => setSelectedRecord(null)}
      onResolve={handleResolve}
    />
    </>
  )
}
