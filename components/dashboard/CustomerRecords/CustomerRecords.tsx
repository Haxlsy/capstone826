"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Search, Filter, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, X } from "lucide-react"

type CustomerStatus = "Active" | "Archived"

interface Customer {
  id: number
  initials: string
  name: string
  email: string
  contact: string
  address: string
  jobs: number
  status: CustomerStatus
}

function makeInitials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 3)
}

function mapApiCustomer(c: any): Customer {
  return {
    id: c.customer_id,
    initials: makeInitials(c.full_name ?? ""),
    name: c.full_name ?? "",
    email: c.email ?? "",
    contact: c.contact_number ?? "",
    address: c.home_address ?? "",
    jobs: 0,
    status: c.is_archived ? "Archived" : "Active",
  }
}

const PAGE_SIZE_OPTIONS = [10, 15, 20]

// ── Add / Edit Customer Modal ─────────────────────────────────────────────────

interface CustomerForm {
  name: string; email: string; contact: string; address: string
}

const emptyForm: CustomerForm = { name: "", email: "", contact: "", address: "" }

function CustomerModal({
  customer,
  onClose,
  onSave,
}: {
  customer: Customer | null
  onClose: () => void
  onSave: (form: CustomerForm) => void
}) {
  const [form, setForm] = useState<CustomerForm>(
    customer
      ? { name: customer.name, email: customer.email, contact: customer.contact, address: customer.address }
      : emptyForm
  )
  const [errors, setErrors] = useState<Partial<CustomerForm>>({})

  function set(key: keyof CustomerForm, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
    setErrors((prev) => { const e = { ...prev }; delete e[key]; return e })
  }

  function handleSave() {
    const e: Partial<CustomerForm> = {}
    if (!form.name.trim()) e.name = "Full name is required."
    if (!form.contact.trim()) e.contact = "Contact number is required."
    if (Object.keys(e).length > 0) { setErrors(e); return }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-800">{customer ? "Edit Customer" : "Add Customer"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {([
            ["name",    "Full Name"],
            ["email",   "Email Address"],
            ["contact", "Contact Number"],
            ["address", "Home Address"],
          ] as [keyof CustomerForm, string][]).map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {label}
                {(key === "name" || key === "contact") && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 transition ${errors[key] ? "border-red-400 focus:ring-red-300" : "border-gray-200 focus:ring-blue-400"}`}
              />
              {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Save Customer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row Actions Menu ──────────────────────────────────────────────────────────

function ActionsMenu({
  customer,
  onEdit,
  onArchive,
  onViewHistory,
}: {
  customer: Customer
  onEdit: () => void
  onArchive: () => void
  onViewHistory: () => void
}) {
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
        <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-xl shadow-lg w-44 py-1 text-sm">
          <button
            onClick={() => { onViewHistory(); setOpen(false) }}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors"
          >
            View Job History
          </button>
          <button
            onClick={() => { onEdit(); setOpen(false) }}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => { onArchive(); setOpen(false) }}
            className={`w-full text-left px-4 py-2 transition-colors ${
              customer.status === "Active"
                ? "hover:bg-red-50 text-red-500"
                : "hover:bg-gray-50 text-gray-700"
            }`}
          >
            {customer.status === "Active" ? "Archive" : "Restore"}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CustomerRecords() {
  const [customers, setCustomers]     = useState<Customer[]>([])
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [search, setSearch]           = useState("")
  const [pageSize, setPageSize]       = useState(15)
  const [page, setPage]               = useState(1)
  const [selected, setSelected]       = useState<Set<number>>(new Set())
  const [modal, setModal]             = useState<"add" | "edit" | null>(null)
  const [editTarget, setEditTarget]   = useState<Customer | null>(null)
  const [exportOpen, setExportOpen]   = useState(false)
  const exportRef                     = useRef<HTMLDivElement>(null)

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/sales/customers")
      const json = await res.json()
      if (!res.ok) { setLoadError(json.error ?? "Failed to load customers."); return }
      setCustomers((json.customers ?? []).map(mapApiCustomer))
    } catch {
      setLoadError("Network error. Could not load customers.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.contact.includes(q) ||
      c.address.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)
  const allOnPageSelected = paginated.length > 0 && paginated.every((c) => selected.has(c.id))

  function toggleAll() {
    if (allOnPageSelected) {
      setSelected((prev) => { const s = new Set(prev); paginated.forEach((c) => s.delete(c.id)); return s })
    } else {
      setSelected((prev) => { const s = new Set(prev); paginated.forEach((c) => s.add(c.id)); return s })
    }
  }

  function toggleOne(id: number) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function handleArchive(id: number) {
    setCustomers((prev) =>
      prev.map((c) => c.id === id ? { ...c, status: c.status === "Active" ? "Archived" : "Active" } : c)
    )
  }

  async function handleSave(form: CustomerForm) {
    if (modal === "edit" && editTarget) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === editTarget.id
            ? { ...c, name: form.name, email: form.email, contact: form.contact, address: form.address,
                initials: makeInitials(form.name) }
            : c
        )
      )
    } else {
      try {
        const res = await fetch("/api/sales/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: form.name, contact_number: form.contact, email: form.email, home_address: form.address }),
        })
        const json = await res.json()
        if (res.ok && json.customer) {
          setCustomers((prev) => [mapApiCustomer(json.customer), ...prev])
          setPage(1)
          setModal(null)
          setEditTarget(null)
          return
        }
      } catch {
        // fall through to local add
      }
      setCustomers((prev) => [
        { id: Date.now(), initials: makeInitials(form.name), name: form.name, email: form.email,
          contact: form.contact, address: form.address, jobs: 0, status: "Active" },
        ...prev,
      ])
      setPage(1)
    }
    setModal(null)
    setEditTarget(null)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Customer Records</h1>
        <button
          onClick={() => { setModal("add"); setEditTarget(null) }}
          className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors shrink-0"
        >
          + Add Customer
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search customers..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        <button className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>

        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Export
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {exportOpen && (
            <div className="absolute left-0 top-10 z-10 bg-white border border-gray-200 rounded-xl shadow-lg w-36 py-1 text-sm">
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors">Export as PDF</button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors">Export as Excel</button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">Loading customers...</div>
        ) : loadError ? (
          <div className="text-center py-16 text-sm text-red-500">{loadError}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded accent-gray-800 cursor-pointer"
                  />
                </th>
                {["CUSTOMER", "EMAIL", "CONTACT", "ADDRESS", "STATUS", ""].map((col) => (
                  <th
                    key={col}
                    className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => {
                const archived = c.status === "Archived"
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${archived ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        className="w-4 h-4 rounded accent-gray-800 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 text-[11px] font-semibold flex items-center justify-center shrink-0">
                          {c.initials}
                        </div>
                        <span className="font-semibold text-gray-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-blue-500">{c.email || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-600">{c.contact}</td>
                    <td className="px-4 py-3.5 text-gray-600">{c.address || "—"}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          archived ? "bg-gray-100 text-gray-400" : "bg-green-100 text-green-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <ActionsMenu
                        customer={c}
                        onEdit={() => { setEditTarget(c); setModal("edit") }}
                        onArchive={() => handleArchive(c.id)}
                        onViewHistory={() => {}}
                      />
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm text-gray-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
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

      {/* Modal */}
      {modal !== null && (
        <CustomerModal
          customer={modal === "edit" ? editTarget : null}
          onClose={() => { setModal(null); setEditTarget(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
