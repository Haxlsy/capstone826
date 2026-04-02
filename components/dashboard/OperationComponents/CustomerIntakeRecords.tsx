"use client"

import { useState } from "react"
import { Search, Filter, Eye, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react"
import IntakeInfoBanner from "./IntakeInfoBanner"
import IntakeRecordDrawer, { type IntakeRecordFull } from "./IntakeRecordDrawer"

type IntakeStatus = "Pending Job Order" | "Job Created" | "Cancelled"
type PaymentType = "DP Paid" | "Full Payment"
type TabType = "All" | "Pending Job Order" | "Job Created" | "Cancelled"

const intakeRecords: IntakeRecordFull[] = [
  {
    id: "INT-2026-015",
    customer: "Juan Dela Cruz",
    contact: "0917-123-4567",
    email: "juan@email.com",
    address: "123 Rizal St, Quezon City",
    plate: "ABC 1234",
    vehicle: "Toyota Fortuner 2022",
    color: "White",
    service: "PPF Installation",
    bookingDate: "Apr 3, 2026",
    payment: "DP Paid",
    paymentMethod: "GCash",
    downpayment: "₱15,000",
    remainingBalance: "₱35,000",
    submitted: "Mar 30, 2026",
    status: "Pending Job Order",
    rescheduleHistory: [
      {
        prevDate: "Apr 1, 2026",
        newDate: "Apr 3, 2026",
        reason: "Customer requested due to schedule conflict",
        changed: "Mar 29, 2026",
      },
    ],
  },
  {
    id: "INT-2026-014",
    customer: "Maria Garcia",
    contact: "0918-234-5678",
    email: "maria@email.com",
    address: "456 Oak Ave, Makati",
    plate: "DEF 5678",
    vehicle: "Honda Civic 2023",
    color: "Silver",
    service: "Ceramic Coating",
    bookingDate: "Apr 2, 2026",
    payment: "Full Payment",
    paymentMethod: "Bank Transfer",
    downpayment: "₱20,000",
    remainingBalance: "₱0",
    submitted: "Mar 29, 2026",
    status: "Job Created",
  },
  {
    id: "INT-2026-013",
    customer: "Carlos Rivera",
    contact: "0919-345-6789",
    email: "carlos@email.com",
    address: "789 Pine Rd, Taguig",
    plate: "GHI 9012",
    vehicle: "Ford Ranger 2022",
    color: "Black",
    service: "Window Tinting",
    bookingDate: "Mar 28, 2026",
    payment: "DP Paid",
    paymentMethod: "Cash",
    downpayment: "₱5,000",
    remainingBalance: "₱8,000",
    submitted: "Mar 28, 2026",
    status: "Job Created",
  },
  {
    id: "INT-2026-012",
    customer: "Ana Reyes",
    contact: "0920-456-7890",
    email: "ana@email.com",
    address: "321 Elm Blvd, Pasig",
    plate: "JKL 3456",
    vehicle: "Mitsubishi Montero 2021",
    color: "Gray",
    service: "Dash Cam Installation",
    bookingDate: "Apr 5, 2026",
    payment: "Full Payment",
    paymentMethod: "GCash",
    downpayment: "₱3,500",
    remainingBalance: "₱0",
    submitted: "Mar 27, 2026",
    status: "Pending Job Order",
  },
  {
    id: "INT-2026-011",
    customer: "Lisa Tan",
    contact: "0921-567-8901",
    email: "lisa@email.com",
    address: "654 Cedar Ln, Mandaluyong",
    plate: "MNO 7890",
    vehicle: "Toyota Vios 2023",
    color: "Pearl White",
    service: "Interior Detailing",
    bookingDate: "Mar 26, 2026",
    payment: "DP Paid",
    paymentMethod: "Cash",
    downpayment: "₱4,000",
    remainingBalance: "₱4,000",
    submitted: "Mar 26, 2026",
    status: "Job Created",
  },
  {
    id: "INT-2026-010",
    customer: "Pedro Santos",
    contact: "0922-678-9012",
    email: "pedro@email.com",
    address: "987 Birch St, Manila",
    plate: "PQR 1234",
    vehicle: "Suzuki Swift 2024",
    color: "Red",
    service: "PPF Installation",
    bookingDate: "Apr 4, 2026",
    payment: "DP Paid",
    paymentMethod: "GCash",
    downpayment: "₱15,000",
    remainingBalance: "₱35,000",
    submitted: "Mar 25, 2026",
    status: "Pending Job Order",
  },
  {
    id: "INT-2026-009",
    customer: "Elena Flores",
    contact: "0923-789-0123",
    email: "elena@email.com",
    address: "147 Maple Dr, Paranaque",
    plate: "STU 5678",
    vehicle: "Hyundai Tucson 2023",
    color: "Blue",
    service: "Ceramic Coating",
    bookingDate: "Mar 24, 2026",
    payment: "DP Paid",
    paymentMethod: "Bank Transfer",
    downpayment: "₱10,000",
    remainingBalance: "₱10,000",
    submitted: "Mar 24, 2026",
    status: "Cancelled",
  },
  {
    id: "INT-2026-008",
    customer: "Roberto Lim",
    contact: "0924-890-1234",
    email: "roberto@email.com",
    address: "258 Walnut Ave, Las Pinas",
    plate: "VWX 9012",
    vehicle: "Mazda CX-5 2022",
    color: "Dark Gray",
    service: "PPF + Ceramic Coating",
    bookingDate: "Apr 7, 2026",
    payment: "DP Paid",
    paymentMethod: "Cash",
    downpayment: "₱25,000",
    remainingBalance: "₱45,000",
    submitted: "Mar 23, 2026",
    status: "Pending Job Order",
  },
]

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
  const [activeTab, setActiveTab] = useState<TabType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [selectedRecord, setSelectedRecord] = useState<IntakeRecordFull | null>(null)

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
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Booking Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Payment</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Submitted</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
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
                          <button className="text-gray-400 hover:text-gray-600 transition-colors">
                            <MoreVertical className="w-4 h-4" />
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
