"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Filter, Eye, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react"
import IntakeInfoBanner from "./IntakeInfoBanner"
import IntakeRecordDrawer, { type IntakeRecordFull } from "./IntakeRecordDrawer"

type IntakeStatus = "Pending Job Order" | "Job Created" | "Cancelled"
type PaymentType = "DP Paid" | "Full Payment"
type TabType = "All" | "Pending Job Order" | "Job Created" | "Cancelled"

const DB_STATUS_MAP: Record<string, IntakeStatus> = {
  pending: "Pending Job Order",
  job_created: "Job Created",
  cancelled: "Cancelled",
}

function mapApiToFull(i: any): IntakeRecordFull {
  const year = new Date(i.created_at).getFullYear()
  const dp = Number(i.downpayment ?? 0)
  const bal = Number(i.balance ?? 0)
  return {
    intake_id: i.intake_id,
    id: `INT-${year}-${String(i.intake_id).padStart(3, "0")}`,
    customer: i.customer?.full_name ?? "—",
    contact: i.customer?.contact_number ?? "—",
    email: i.customer?.email ?? "—",
    address: i.customer?.home_address ?? "—",
    plate: i.plate_number ?? "—",
    vehicle: [i.make, i.model].filter(Boolean).join(" ") || "—",
    color: i.color ?? "—",
    service: i.service?.service_name ?? "—",
    bookingDate: i.scheduled_date
      ? new Date(i.scheduled_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—",
    payment: bal === 0 ? "Full Payment" : "DP Paid",
    paymentMethod: i.payment_method ?? "—",
    downpayment: `₱${dp.toLocaleString("en-PH")}`,
    remainingBalance: `₱${bal.toLocaleString("en-PH")}`,
    submitted: new Date(i.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    status: DB_STATUS_MAP[i.status] ?? "Pending Job Order",
  }
}

const TABS: TabType[] = ["All", "Pending Job Order", "Job Created", "Cancelled"]

const paymentBadgeMap: Record<PaymentType, string> = {
  "DP Paid": "bg-blue-100 text-blue-700",
  "Full Payment": "bg-green-100 text-green-700",
}

const statusBadgeMap: Record<IntakeStatus, string> = {
  "Pending Job Order": "bg-amber-100 text-amber-700",
  "Job Created": "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-500",
}

export default function CustomerIntakeRecords() {
  const router = useRouter()
  const [intakeRecords, setIntakeRecords] = useState<IntakeRecordFull[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [selectedRecord, setSelectedRecord] = useState<IntakeRecordFull | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch("/api/sales/intakes")
        const json = await res.json()
        if (res.ok) setIntakeRecords((json.intakes ?? []).map(mapApiToFull))
      } catch {
        // leave empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = intakeRecords.filter((record) => {
    const matchesTab = activeTab === "All" || record.status === activeTab
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      q === "" ||
      record.customer.toLowerCase().includes(q) ||
      record.id.toLowerCase().includes(q) ||
      record.plate.toLowerCase().includes(q)
    return matchesTab && matchesSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
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
          <h1 className="text-xl font-bold text-gray-800">Customer Intake Records</h1>
          <p className="text-sm text-gray-400 mt-0.5">Submitted by Sales. Data is read-only.</p>
        </div>

        {/* Search + Filter row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, intake ID, or plate number..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
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
              onClick={() => handleTabChange(tab)}
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

        {/* Info banner */}
        <IntakeInfoBanner />

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Intake ID</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Customer Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Contact</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Vehicle</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Service Type</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Scheduled Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Payment</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Submitted</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
                    Loading intake records...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
                    No intake records found.
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
                      <span className="text-xs text-gray-500 font-mono">{record.id}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-semibold text-gray-800">{record.customer}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-600">{record.contact}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="text-sm text-gray-800 font-medium">{record.plate}</p>
                        <p className="text-xs text-gray-400">{record.vehicle}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-700">{record.service}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-600">{record.bookingDate}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadgeMap[record.payment]}`}>
                        {record.payment}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-400">{record.submitted}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeMap[record.status]}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="text-gray-400 hover:text-blue-500 transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {record.status === "Pending Job Order" && (
                          <button
                            onClick={() => router.push(`/dashboard/job-management/add?intake_id=${record.intake_id}`)}
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md px-2 py-1 hover:bg-blue-50 transition-colors"
                            title="Create Job Order"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Create JO
                          </button>
                        )}
                      </div>
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
      <IntakeRecordDrawer
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </>
  )
}
