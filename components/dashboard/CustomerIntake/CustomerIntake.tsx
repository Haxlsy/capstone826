"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Filter, MoreHorizontal, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react"

type IntakeStatus = "Pending Job Order" | "Job Created" | "Cancelled"
type PaymentStatus = "DP Paid" | "Full Payment"
type TabFilter = "All" | IntakeStatus

interface IntakeRecord {
  id: string
  customerName: string
  plate: string
  vehicle: string
  serviceType: string
  scheduledDate: string
  rescheduled: boolean
  paymentStatus: PaymentStatus
  dateSubmitted: string
  status: IntakeStatus
}

const mockData: IntakeRecord[] = [
  { id: "INT-2026-015", customerName: "Juan Dela Cruz",   plate: "ABC 1234", vehicle: "Fortuner",  serviceType: "Paint Protection Film (PPF)", scheduledDate: "Apr 3, 2026",  rescheduled: false, paymentStatus: "DP Paid",      dateSubmitted: "Mar 30, 2026", status: "Pending Job Order" },
  { id: "INT-2026-014", customerName: "Maria Garcia",     plate: "DEF 5678", vehicle: "Civic",     serviceType: "Ceramic Coating",             scheduledDate: "Apr 1, 2026",  rescheduled: false, paymentStatus: "Full Payment", dateSubmitted: "Mar 29, 2026", status: "Job Created"       },
  { id: "INT-2026-013", customerName: "Carlos Rivera",    plate: "GHI 9012", vehicle: "Ranger",    serviceType: "Window Tinting",              scheduledDate: "Apr 5, 2026",  rescheduled: true,  paymentStatus: "DP Paid",      dateSubmitted: "Mar 28, 2026", status: "Pending Job Order" },
  { id: "INT-2026-012", customerName: "Ana Reyes",        plate: "JKL 3456", vehicle: "Montero",   serviceType: "Dash Cam Installation",       scheduledDate: "Mar 30, 2026", rescheduled: false, paymentStatus: "Full Payment", dateSubmitted: "Mar 27, 2026", status: "Job Created"       },
  { id: "INT-2026-011", customerName: "Lisa Tan",         plate: "MNO 7890", vehicle: "Vios",      serviceType: "Interior Detailing",          scheduledDate: "Mar 29, 2026", rescheduled: false, paymentStatus: "DP Paid",      dateSubmitted: "Mar 26, 2026", status: "Job Created"       },
  { id: "INT-2026-010", customerName: "Pedro Santos",     plate: "PQR 1234", vehicle: "Swift",     serviceType: "Paint Protection Film (PPF)", scheduledDate: "Apr 7, 2026",  rescheduled: true,  paymentStatus: "DP Paid",      dateSubmitted: "Mar 25, 2026", status: "Cancelled"         },
  { id: "INT-2026-009", customerName: "Elena Flores",     plate: "STU 5678", vehicle: "Navara",    serviceType: "Ceramic Coating",             scheduledDate: "Mar 28, 2026", rescheduled: false, paymentStatus: "Full Payment", dateSubmitted: "Mar 24, 2026", status: "Job Created"       },
  { id: "INT-2026-008", customerName: "Roberto Lim",      plate: "VWX 9012", vehicle: "Tucson",    serviceType: "Window Tinting",              scheduledDate: "Mar 27, 2026", rescheduled: false, paymentStatus: "DP Paid",      dateSubmitted: "Mar 23, 2026", status: "Job Created"       },
  { id: "INT-2026-007", customerName: "Kenneth Ong",      plate: "YZA 3456", vehicle: "Civic",     serviceType: "Dash Cam Installation",       scheduledDate: "Mar 26, 2026", rescheduled: false, paymentStatus: "Full Payment", dateSubmitted: "Mar 22, 2026", status: "Cancelled"         },
  { id: "INT-2026-006", customerName: "David Villanueva", plate: "BCD 7890", vehicle: "Fortuner",  serviceType: "Interior Detailing",          scheduledDate: "Apr 8, 2026",  rescheduled: true,  paymentStatus: "DP Paid",      dateSubmitted: "Mar 21, 2026", status: "Pending Job Order" },
  { id: "INT-2026-005", customerName: "Rosa Santiago",    plate: "EFG 1234", vehicle: "Innova",    serviceType: "Ceramic Coating",             scheduledDate: "Apr 9, 2026",  rescheduled: false, paymentStatus: "Full Payment", dateSubmitted: "Mar 20, 2026", status: "Job Created"       },
  { id: "INT-2026-004", customerName: "Marco Reyes",      plate: "HIJ 5678", vehicle: "Hilux",     serviceType: "Window Tinting",              scheduledDate: "Apr 10, 2026", rescheduled: false, paymentStatus: "DP Paid",      dateSubmitted: "Mar 19, 2026", status: "Pending Job Order" },
  { id: "INT-2026-003", customerName: "Angela Cruz",      plate: "KLM 9012", vehicle: "BT-50",     serviceType: "Full Detail",                 scheduledDate: "Mar 18, 2026", rescheduled: false, paymentStatus: "Full Payment", dateSubmitted: "Mar 18, 2026", status: "Job Created"       },
  { id: "INT-2026-002", customerName: "Bernard Tan",      plate: "NOP 3456", vehicle: "CR-V",      serviceType: "Interior Detailing",          scheduledDate: "Mar 15, 2026", rescheduled: false, paymentStatus: "DP Paid",      dateSubmitted: "Mar 14, 2026", status: "Cancelled"         },
  { id: "INT-2026-001", customerName: "Carla Mendoza",    plate: "QRS 7890", vehicle: "Fortuner",  serviceType: "Paint Protection Film (PPF)", scheduledDate: "Mar 10, 2026", rescheduled: false, paymentStatus: "Full Payment", dateSubmitted: "Mar 9, 2026",  status: "Job Created"       },
  { id: "INT-2026-016", customerName: "Francis Uy",       plate: "TUV 1234", vehicle: "Ranger",    serviceType: "Ceramic Coating",             scheduledDate: "Apr 12, 2026", rescheduled: false, paymentStatus: "DP Paid",      dateSubmitted: "Apr 1, 2026",  status: "Pending Job Order" },
  { id: "INT-2026-017", customerName: "Grace Santos",     plate: "WXY 5678", vehicle: "Vios",      serviceType: "Window Tinting",              scheduledDate: "Apr 14, 2026", rescheduled: true,  paymentStatus: "Full Payment", dateSubmitted: "Apr 2, 2026",  status: "Job Created"       },
  { id: "INT-2026-018", customerName: "Henry Lim",        plate: "ZAB 9012", vehicle: "Civic",     serviceType: "Dash Cam Installation",       scheduledDate: "Apr 15, 2026", rescheduled: false, paymentStatus: "DP Paid",      dateSubmitted: "Apr 3, 2026",  status: "Cancelled"         },
]

const PAGE_SIZE_OPTIONS = [10, 15, 20]

const tabs: TabFilter[] = ["All", "Pending Job Order", "Job Created", "Cancelled"]

const statusBadge: Record<IntakeStatus, string> = {
  "Pending Job Order": "bg-yellow-100 text-yellow-700",
  "Job Created":       "bg-green-100 text-green-600",
  "Cancelled":         "bg-gray-100 text-gray-400",
}

const paymentBadge: Record<PaymentStatus, string> = {
  "DP Paid":      "bg-blue-100 text-blue-500",
  "Full Payment": "bg-green-100 text-green-600",
}

// ── New Intake Modal ──────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  "Paint Protection Film (PPF)",
  "Ceramic Coating",
  "Window Tinting",
  "Dash Cam Installation",
  "Interior Detailing",
  "Full Detail",
]

const PAYMENT_METHODS = ["Cash", "GCash", "Bank Transfer", "Credit Card"]

interface NewIntakeForm {
  customerName: string; contactNumber: string; email: string; address: string
  plate: string; make: string; model: string; color: string
  serviceType: string; downpayment: string; balance: string; paymentMethod: string
  scheduledDate: string
}

const emptyForm: NewIntakeForm = {
  customerName: "", contactNumber: "", email: "", address: "",
  plate: "", make: "", model: "", color: "",
  serviceType: "", downpayment: "", balance: "", paymentMethod: "",
  scheduledDate: "",
}

function NewIntakeModal({ onClose, onSave }: { onClose: () => void; onSave: (f: NewIntakeForm) => void }) {
  const [form, setForm] = useState<NewIntakeForm>(emptyForm)

  function set(key: keyof NewIntakeForm, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function handleSave() {
    if (!form.customerName.trim() || !form.plate.trim() || !form.serviceType) return
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-800">New Customer Intake</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Customer Details */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Customer Details</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["customerName", "Full Name"],
                ["contactNumber", "Contact Number"],
                ["email", "Email Address"],
                ["address", "Home Address"],
              ] as [keyof NewIntakeForm, string][]).map(([key, label]) => (
                <div key={key} className={key === "address" ? "col-span-2" : ""}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Vehicle Info */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Vehicle Information</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["plate", "Plate Number"],
                ["make", "Make"],
                ["model", "Model"],
                ["color", "Color"],
              ] as [keyof NewIntakeForm, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Service & Payment */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Service & Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Service Type</label>
                <select
                  value={form.serviceType}
                  onChange={(e) => set("serviceType", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                >
                  <option value="">Select service...</option>
                  {SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => set("scheduledDate", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Downpayment (₱)</label>
                <input
                  type="number"
                  value={form.downpayment}
                  onChange={(e) => set("downpayment", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Remaining Balance (₱)</label>
                <input
                  type="number"
                  value={form.balance}
                  onChange={(e) => set("balance", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => set("paymentMethod", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                >
                  <option value="">Select method...</option>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
            Save Intake
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row Actions Menu ──────────────────────────────────────────────────────────

function ActionsMenu({ record, onCancel }: { record: IntakeRecord; onCancel: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-xl shadow-lg w-40 py-1 text-sm">
          <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors">
            View Details
          </button>
          {record.status !== "Cancelled" && (
            <>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors">
                Edit
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors">
                Reschedule
              </button>
              <button
                onClick={() => { onCancel(record.id); setOpen(false) }}
                className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-500 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CustomerIntake() {
  const [records, setRecords] = useState<IntakeRecord[]>(mockData)
  const [tab, setTab] = useState<TabFilter>("All")
  const [search, setSearch] = useState("")
  const [pageSize, setPageSize] = useState(15)
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)

  const filtered = records.filter((r) => {
    const matchTab = tab === "All" || r.status === tab
    const q = search.toLowerCase()
    const matchSearch =
      r.customerName.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.plate.toLowerCase().includes(q) ||
      r.vehicle.toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  function handleCancel(id: string) {
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, status: "Cancelled" } : r))
  }

  function handleNewIntake(form: NewIntakeForm) {
    const nextId = `INT-2026-${String(records.length + 1).padStart(3, "0")}`
    const newRecord: IntakeRecord = {
      id: nextId,
      customerName: form.customerName,
      plate: form.plate,
      vehicle: form.model || "—",
      serviceType: form.serviceType,
      scheduledDate: form.scheduledDate
        ? new Date(form.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "—",
      rescheduled: false,
      paymentStatus: Number(form.balance) === 0 ? "Full Payment" : "DP Paid",
      dateSubmitted: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status: "Pending Job Order",
    }
    setRecords((prev) => [newRecord, ...prev])
    setShowModal(false)
    setPage(1)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Customer Intake Records</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors shrink-0"
        >
          + New Intake
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>
        <button className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-0">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1) }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              tab === t
                ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-b-2xl rounded-tr-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {["INTAKE ID", "CUSTOMER NAME", "VEHICLE", "SERVICE TYPE", "SCHEDULED DATE", "PAYMENT STATUS", "DATE SUBMITTED", "STATUS", ""].map((col) => (
                <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((r) => {
              const cancelled = r.status === "Cancelled"
              const dim = cancelled ? "text-gray-400" : "text-gray-700"
              return (
                <tr key={r.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${cancelled ? "opacity-60" : ""}`}>
                  <td className={`px-4 py-3.5 font-mono text-xs ${cancelled ? "text-gray-400" : "text-blue-500"}`}>{r.id}</td>
                  <td className={`px-4 py-3.5 font-semibold ${dim}`}>{r.customerName}</td>
                  <td className={`px-4 py-3.5 ${dim}`}>{r.plate} — {r.vehicle}</td>
                  <td className={`px-4 py-3.5 ${dim}`}>{r.serviceType}</td>
                  <td className={`px-4 py-3.5 ${dim}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{r.scheduledDate}</span>
                      {r.rescheduled && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
                          <RefreshCw className="w-2.5 h-2.5" />
                          Rescheduled
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cancelled ? "bg-gray-100 text-gray-400" : paymentBadge[r.paymentStatus]}`}>
                      {r.paymentStatus}
                    </span>
                  </td>
                  <td className={`px-4 py-3.5 ${dim}`}>{r.dateSubmitted}</td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <ActionsMenu record={r} onCancel={handleCancel} />
                  </td>
                </tr>
              )
            })}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-10 text-sm text-gray-400">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Show Results:</span>
          <div className="relative">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="appearance-none pl-3 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n}>{n}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                page === n ? "bg-gray-900 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showModal && <NewIntakeModal onClose={() => setShowModal(false)} onSave={handleNewIntake} />}
    </div>
  )
}
