"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, Car, Phone, Mail, Pencil, X, Check } from "lucide-react"
import { getInitials } from "@/hooks/useCurrentUser"

interface CustomerRecord {
  id:            string
  fullName:      string
  contactNumber: string
  email:         string | null
  plateNumber:   string
  vehicleUnit:   string
  psid:          string | null
  createdAt:     string
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const EDIT_INPUT = "text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"

export default function CustomerRecords() {
  const [records, setRecords]   = useState<CustomerRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const [search, setSearch]     = useState("")

  const isFirstRender = useRef(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<CustomerRecord>>({})
  const [saving, setSaving]       = useState(false)
  const [saveErr, setSaveErr]     = useState<string | null>(null)

  const load = useCallback(async (q = "") => {
    setLoading(true)
    setFetchErr(null)
    try {
      const res  = await fetch(`/api/sales/customer-records${q ? `?search=${encodeURIComponent(q)}` : ""}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load records")
      const shaped: CustomerRecord[] = (json.records ?? []).map((r: any) => ({
        id:            r.id,
        fullName:      r.full_name,
        contactNumber: r.contact_number,
        email:         r.email ?? null,
        plateNumber:   r.plate_number,
        vehicleUnit:   r.vehicle_unit,
        psid:          r.psid ?? null,
        createdAt:     fmtDate(r.created_at),
      }))
      setRecords(shaped)
    } catch (err: unknown) {
      setFetchErr(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      load()
      return
    }
    const t = setTimeout(() => { load(search) }, 300)
    return () => clearTimeout(t)
  }, [search, load])

  function startEdit(record: CustomerRecord) {
    setEditingId(record.id)
    setEditDraft({
      fullName:      record.fullName,
      contactNumber: record.contactNumber,
      email:         record.email ?? "",
      plateNumber:   record.plateNumber,
      vehicleUnit:   record.vehicleUnit,
    })
    setSaveErr(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
    setSaveErr(null)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    setSaveErr(null)
    try {
      const res  = await fetch(`/api/sales/customer-records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name:      editDraft.fullName,
          contact_number: editDraft.contactNumber,
          email:          editDraft.email || null,
          plate_number:   editDraft.plateNumber,
          vehicle_unit:   editDraft.vehicleUnit,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to save")

      setRecords((prev) =>
        prev.map((r) => r.id === id ? { ...r, ...editDraft } as CustomerRecord : r)
      )
      setEditingId(null)
      setEditDraft({})
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Customer Records</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Confirmed customer details from booking inquiries.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, plate, or contact…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Customer", "Vehicle", "Plate Number", "Contact", "Email", "Recorded", ""].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-sm text-gray-400">Loading records…</td>
              </tr>
            ) : fetchErr ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-sm text-red-500">{fetchErr}</td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-sm text-gray-400">No records found.</td>
              </tr>
            ) : (
              records.map((record) => {
                const isEditing = editingId === record.id
                return (
                  <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Customer */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                          {getInitials(record.fullName)}
                        </div>
                        {isEditing ? (
                          <input
                            aria-label="Full name"
                            className={`${EDIT_INPUT} w-40`}
                            value={editDraft.fullName ?? ""}
                            onChange={(e) => setEditDraft((d) => ({ ...d, fullName: e.target.value }))}
                          />
                        ) : (
                          <div>
                            <p className="font-medium text-gray-800">{record.fullName}</p>
                            {record.psid && (
                              <p className="text-[11px] text-gray-400 font-mono">{record.psid}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Vehicle */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <input
                          aria-label="Vehicle unit"
                          className={`${EDIT_INPUT} w-36`}
                          value={editDraft.vehicleUnit ?? ""}
                          onChange={(e) => setEditDraft((d) => ({ ...d, vehicleUnit: e.target.value }))}
                        />
                      ) : (
                        <span className="text-gray-700">{record.vehicleUnit}</span>
                      )}
                    </td>

                    {/* Plate */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <input
                          aria-label="Plate number"
                          className={`${EDIT_INPUT} w-28`}
                          value={editDraft.plateNumber ?? ""}
                          onChange={(e) => setEditDraft((d) => ({ ...d, plateNumber: e.target.value }))}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Car className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="font-mono font-medium text-gray-700">{record.plateNumber}</span>
                        </div>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <input
                          aria-label="Contact number"
                          className={`${EDIT_INPUT} w-36`}
                          value={editDraft.contactNumber ?? ""}
                          onChange={(e) => setEditDraft((d) => ({ ...d, contactNumber: e.target.value }))}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-gray-700">{record.contactNumber}</span>
                        </div>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <input
                          aria-label="Email"
                          type="email"
                          className={`${EDIT_INPUT} w-44`}
                          value={editDraft.email ?? ""}
                          onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-gray-700 text-sm">{record.email ?? <span className="text-gray-400">—</span>}</span>
                        </div>
                      )}
                    </td>

                    {/* Recorded */}
                    <td className="px-5 py-4 text-gray-400 text-xs">{record.createdAt}</td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveEdit(record.id)}
                              disabled={saving}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" /> Cancel
                            </button>
                          </div>
                          {saveErr && <p className="text-[11px] text-red-500">{saveErr}</p>}
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(record)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
