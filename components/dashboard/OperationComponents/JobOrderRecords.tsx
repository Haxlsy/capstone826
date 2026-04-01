"use client"

import { useState } from "react"
import { Search, ChevronLeft, ChevronRight, FileText, FileSpreadsheet } from "lucide-react"
import JobHistoryDrawer, { type JobOrderFull } from "./JobHistoryDrawer"

const jobOrderData: JobOrderFull[] = [
  {
    id: "JO-2026-001",
    customer: "Juan Dela Cruz",
    vehicle: "ABC-1234",
    service: "PPF",
    technician: "Mark Santos",
    status: "Released",
    created: "Jan 5, 2026",
    completed: "Jan 12, 2026",
    history: [
      { status: "Pending",       time: "Jan 5, 2026, 10:00 AM",  actor: "System — Auto-created" },
      { status: "Ongoing",       time: "Jan 6, 2026, 8:30 AM",   actor: "Technician: Mark Santos" },
      { status: "Quality Check", time: "Jan 11, 2026, 3:00 PM",  actor: "Technician: Mark Santos" },
      { status: "Completed",     time: "Jan 12, 2026, 11:00 AM", actor: "Head Technician: Ana Reyes" },
      { status: "Released",      time: "Jan 12, 2026, 4:30 PM",  actor: "Operations: Maria Santos" },
    ],
    stages: [
      { name: "Surface Preparation", date: "Jan 6, 2026",  done: true },
      { name: "Film Cutting",         date: "Jan 7, 2026",  done: true },
      { name: "Film Application",     date: "Jan 8, 2026",  done: true },
      { name: "Edge Sealing",         date: "Jan 9, 2026",  done: true },
      { name: "Final Inspection",     date: "Jan 10, 2026", done: true },
    ],
    documentation: 4,
  },
  {
    id: "JO-2026-002",
    customer: "Maria Garcia",
    vehicle: "DEF-5678",
    service: "Ceramic Coating",
    technician: "Pedro Lim",
    status: "Released",
    created: "Jan 8, 2026",
    completed: "Jan 14, 2026",
    history: [
      { status: "Pending",       time: "Jan 8, 2026, 9:00 AM",   actor: "System — Auto-created" },
      { status: "Ongoing",       time: "Jan 9, 2026, 8:00 AM",   actor: "Technician: Pedro Lim" },
      { status: "Quality Check", time: "Jan 13, 2026, 2:00 PM",  actor: "Technician: Pedro Lim" },
      { status: "Completed",     time: "Jan 14, 2026, 10:00 AM", actor: "Head Technician: Ana Reyes" },
      { status: "Released",      time: "Jan 14, 2026, 3:00 PM",  actor: "Operations: Maria Santos" },
    ],
    stages: [
      { name: "Surface Decontamination", date: "Jan 9, 2026",  done: true },
      { name: "Paint Correction",         date: "Jan 10, 2026", done: true },
      { name: "Coating Application",      date: "Jan 11, 2026", done: true },
      { name: "Curing",                   date: "Jan 12, 2026", done: true },
      { name: "Final Inspection",         date: "Jan 13, 2026", done: true },
    ],
    documentation: 3,
  },
  {
    id: "JO-2026-003",
    customer: "Carlos Rivera",
    vehicle: "GHI-9012",
    service: "Window Tinting",
    technician: "Rosa Aquino",
    status: "Completed",
    created: "Jan 15, 2026",
    completed: "Jan 17, 2026",
    history: [
      { status: "Pending",       time: "Jan 15, 2026, 9:00 AM",  actor: "System — Auto-created" },
      { status: "Ongoing",       time: "Jan 15, 2026, 10:00 AM", actor: "Technician: Rosa Aquino" },
      { status: "Quality Check", time: "Jan 16, 2026, 4:00 PM",  actor: "Technician: Rosa Aquino" },
      { status: "Completed",     time: "Jan 17, 2026, 11:00 AM", actor: "Head Technician: Ana Reyes" },
    ],
    stages: [
      { name: "Surface Cleaning",  date: "Jan 15, 2026", done: true },
      { name: "Film Cutting",      date: "Jan 15, 2026", done: true },
      { name: "Film Installation", date: "Jan 16, 2026", done: true },
      { name: "Edge Finishing",    date: "Jan 16, 2026", done: true },
    ],
    documentation: 2,
  },
  {
    id: "JO-2026-004",
    customer: "Ana Reyes",
    vehicle: "JKL-3456",
    service: "Dash Cam",
    technician: "Mark Santos",
    status: "Delayed",
    created: "Feb 1, 2026",
    completed: null,
    history: [
      { status: "Pending", time: "Feb 1, 2026, 9:00 AM",  actor: "System — Auto-created" },
      { status: "Ongoing", time: "Feb 2, 2026, 8:00 AM",  actor: "Technician: Mark Santos" },
      { status: "Delayed", time: "Feb 5, 2026, 11:00 AM", actor: "Operations: Maria Santos" },
    ],
    stages: [
      { name: "Unit Preparation", date: "Feb 2, 2026", done: true },
      { name: "Installation",     date: "Feb 3, 2026", done: false },
      { name: "Testing",          date: "—",           done: false },
    ],
    documentation: 1,
  },
  {
    id: "JO-2026-005",
    customer: "Lisa Tan",
    vehicle: "MNO-7890",
    service: "PPF",
    technician: "Pedro Lim",
    status: "Released",
    created: "Feb 10, 2026",
    completed: "Feb 18, 2026",
    history: [
      { status: "Pending",       time: "Feb 10, 2026, 9:00 AM",  actor: "System — Auto-created" },
      { status: "Ongoing",       time: "Feb 11, 2026, 8:00 AM",  actor: "Technician: Pedro Lim" },
      { status: "Quality Check", time: "Feb 17, 2026, 3:00 PM",  actor: "Technician: Pedro Lim" },
      { status: "Completed",     time: "Feb 18, 2026, 10:00 AM", actor: "Head Technician: Ana Reyes" },
      { status: "Released",      time: "Feb 18, 2026, 2:30 PM",  actor: "Operations: Maria Santos" },
    ],
    stages: [
      { name: "Surface Preparation", date: "Feb 11, 2026", done: true },
      { name: "Film Cutting",         date: "Feb 12, 2026", done: true },
      { name: "Film Application",     date: "Feb 13, 2026", done: true },
      { name: "Edge Sealing",         date: "Feb 14, 2026", done: true },
      { name: "Final Inspection",     date: "Feb 17, 2026", done: true },
    ],
    documentation: 4,
  },
  {
    id: "JO-2026-006",
    customer: "Pedro Santos",
    vehicle: "PQR-1234",
    service: "Interior Detailing",
    technician: "David Cruz",
    status: "Released",
    created: "Feb 20, 2026",
    completed: "Feb 22, 2026",
    history: [
      { status: "Pending",       time: "Feb 20, 2026, 9:00 AM",  actor: "System — Auto-created" },
      { status: "Ongoing",       time: "Feb 20, 2026, 10:00 AM", actor: "Technician: David Cruz" },
      { status: "Quality Check", time: "Feb 21, 2026, 4:00 PM",  actor: "Technician: David Cruz" },
      { status: "Completed",     time: "Feb 22, 2026, 9:30 AM",  actor: "Head Technician: Ana Reyes" },
      { status: "Released",      time: "Feb 22, 2026, 1:00 PM",  actor: "Operations: Maria Santos" },
    ],
    stages: [
      { name: "Vacuum & Dusting",    date: "Feb 20, 2026", done: true },
      { name: "Stain Removal",        date: "Feb 20, 2026", done: true },
      { name: "Leather Conditioning", date: "Feb 21, 2026", done: true },
      { name: "Final Wipe Down",      date: "Feb 21, 2026", done: true },
    ],
    documentation: 3,
  },
  {
    id: "JO-2026-007",
    customer: "Elena Flores",
    vehicle: "STU-5678",
    service: "Ceramic Coating",
    technician: "Rosa Aquino",
    status: "Ongoing",
    created: "Mar 10, 2026",
    completed: null,
    history: [
      { status: "Pending", time: "Mar 10, 2026, 9:00 AM", actor: "System — Auto-created" },
      { status: "Ongoing", time: "Mar 11, 2026, 8:30 AM", actor: "Technician: Rosa Aquino" },
    ],
    stages: [
      { name: "Surface Decontamination", date: "Mar 11, 2026", done: true },
      { name: "Paint Correction",         date: "Mar 12, 2026", done: false },
      { name: "Coating Application",      date: "—",            done: false },
      { name: "Curing",                   date: "—",            done: false },
    ],
    documentation: 1,
  },
  {
    id: "JO-2026-008",
    customer: "Roberto Lim",
    vehicle: "VWX-9012",
    service: "Window Tinting",
    technician: "Mark Santos",
    status: "Pending",
    created: "Mar 20, 2026",
    completed: null,
    history: [
      { status: "Pending", time: "Mar 20, 2026, 9:00 AM", actor: "System — Auto-created" },
    ],
    stages: [
      { name: "Surface Cleaning",  date: "—", done: false },
      { name: "Film Cutting",      date: "—", done: false },
      { name: "Film Installation", date: "—", done: false },
      { name: "Edge Finishing",    date: "—", done: false },
    ],
    documentation: 0,
  },
]

const statusBadgeMap: Record<JobOrderFull["status"], string> = {
  Released:       "bg-teal-100 text-teal-600",
  Completed:      "bg-green-100 text-green-600",
  Delayed:        "bg-red-100 text-red-500",
  Ongoing:        "bg-blue-100 text-blue-600",
  Pending:        "bg-amber-100 text-amber-600",
  "Quality Check":"bg-orange-100 text-orange-500",
  Cancelled:      "bg-gray-100 text-gray-500",
}

export default function JobOrderRecords() {
  const [records] = useState<JobOrderFull[]>(jobOrderData)
  const [selectedRecord, setSelectedRecord] = useState<JobOrderFull | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [serviceTypeFilter, setServiceTypeFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [technicianFilter, setTechnicianFilter] = useState("All")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // Pending filter state (applied only on "Apply Filters")
  const [pendingServiceType, setPendingServiceType] = useState("All")
  const [pendingStatus, setPendingStatus] = useState("All")
  const [pendingTechnician, setPendingTechnician] = useState("All")
  const [pendingStartDate, setPendingStartDate] = useState("")
  const [pendingEndDate, setPendingEndDate] = useState("")

  function handleApplyFilters() {
    setServiceTypeFilter(pendingServiceType)
    setStatusFilter(pendingStatus)
    setTechnicianFilter(pendingTechnician)
    setStartDate(pendingStartDate)
    setEndDate(pendingEndDate)
    setCurrentPage(1)
  }

  function handleReset() {
    setPendingServiceType("All")
    setPendingStatus("All")
    setPendingTechnician("All")
    setPendingStartDate("")
    setPendingEndDate("")
    setServiceTypeFilter("All")
    setStatusFilter("All")
    setTechnicianFilter("All")
    setStartDate("")
    setEndDate("")
    setSearchQuery("")
    setCurrentPage(1)
  }

  const filtered = records.filter((record) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      q === "" ||
      record.customer.toLowerCase().includes(q) ||
      record.id.toLowerCase().includes(q)
    const matchesService = serviceTypeFilter === "All" || record.service === serviceTypeFilter
    const matchesStatus = statusFilter === "All" || record.status === statusFilter
    const matchesTechnician = technicianFilter === "All" || record.technician === technicianFilter
    return matchesSearch && matchesService && matchesStatus && matchesTechnician
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const labelClass = "block text-xs font-medium text-gray-500 mb-1"
  const inputClass =
    "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Job Order Records</h1>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-end gap-4 flex-wrap">
          {/* Start Date */}
          <div>
            <label className={labelClass}>Start Date</label>
            <input
              type="date"
              value={pendingStartDate}
              onChange={(e) => setPendingStartDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* End Date */}
          <div>
            <label className={labelClass}>End Date</label>
            <input
              type="date"
              value={pendingEndDate}
              onChange={(e) => setPendingEndDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Service Type */}
          <div>
            <label className={labelClass}>Service Type</label>
            <select
              value={pendingServiceType}
              onChange={(e) => setPendingServiceType(e.target.value)}
              className={inputClass}
            >
              <option value="All">All</option>
              <option value="PPF">PPF</option>
              <option value="Ceramic Coating">Ceramic Coating</option>
              <option value="Window Tinting">Window Tinting</option>
              <option value="Dash Cam">Dash Cam</option>
              <option value="Interior Detailing">Interior Detailing</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={pendingStatus}
              onChange={(e) => setPendingStatus(e.target.value)}
              className={inputClass}
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Quality Check">Quality Check</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
              <option value="Released">Released</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Technician */}
          <div>
            <label className={labelClass}>Technician</label>
            <select
              value={pendingTechnician}
              onChange={(e) => setPendingTechnician(e.target.value)}
              className={inputClass}
            >
              <option value="All">All</option>
              <option value="Mark Santos">Mark Santos</option>
              <option value="Pedro Lim">Pedro Lim</option>
              <option value="Rosa Aquino">Rosa Aquino</option>
              <option value="David Cruz">David Cruz</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyFilters}
              className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              Apply Filters
            </button>
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer ml-1 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Search + Export row */}
        <div className="flex items-center justify-between">
          {/* Search */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-colors bg-white">
              <FileText className="w-4 h-4" />
              Export PDF
            </button>
            <button className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-colors bg-white">
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Job Order ID</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Vehicle</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Service</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Technician</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Created</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Completed</th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                    No job order records found.
                  </td>
                </tr>
              ) : (
                paginated.map((record, idx) => (
                  <tr
                    key={record.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                      idx === paginated.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-mono text-gray-500">{record.id}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-semibold text-gray-800">{record.customer}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-blue-500">{record.vehicle}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-700">{record.service}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-600">{record.technician}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeMap[record.status]}`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-600">{record.created}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {record.completed ? (
                        <span className="text-sm text-gray-600">{record.completed}</span>
                      ) : (
                        <span className="text-sm text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="text-blue-500 hover:text-blue-700 text-sm font-medium transition-colors"
                      >
                        View History
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
                  page === currentPage ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
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

      {/* Slide-in drawer */}
      <JobHistoryDrawer
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </>
  )
}
