"use client"

import { useState } from "react"
import { Search, Car, Phone, User, Pencil, X, Check } from "lucide-react"

interface CustomerRecord {
  id: string
  fullName: string
  contactNumber: string
  plateNumber: string
  vehicleUnit: string
  psid: string
  createdAt: string
}

const MOCK_RECORDS: CustomerRecord[] = [
  {
    id: "1",
    fullName: "Maria Santos",
    contactNumber: "09171234567",
    plateNumber: "ABC 1234",
    vehicleUnit: "Toyota Fortuner",
    psid: "PSID_7823641",
    createdAt: "Apr 11, 2026",
  },
  {
    id: "2",
    fullName: "Carlo Reyes",
    contactNumber: "09281234567",
    plateNumber: "XYZ 5678",
    vehicleUnit: "Honda CR-V",
    psid: "PSID_4491028",
    createdAt: "Apr 11, 2026",
  },
  {
    id: "3",
    fullName: "Jose Dela Cruz",
    contactNumber: "09951234567",
    plateNumber: "DEF 9012",
    vehicleUnit: "Mitsubishi Montero",
    psid: "PSID_3312874",
    createdAt: "Apr 10, 2026",
  },
]

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export default function CustomerRecords() {
  const [records, setRecords] = useState<CustomerRecord[]>(MOCK_RECORDS)
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<CustomerRecord>>({})

  const filtered = records.filter((r) => {
    const q = search.toLowerCase()
    return (
      r.fullName.toLowerCase().includes(q) ||
      r.plateNumber.toLowerCase().includes(q) ||
      r.contactNumber.includes(q)
    )
  })

  function startEdit(record: CustomerRecord) {
    setEditingId(record.id)
    setEditDraft({
      fullName: record.fullName,
      contactNumber: record.contactNumber,
      plateNumber: record.plateNumber,
      vehicleUnit: record.vehicleUnit,
    })
  }

  function saveEdit(id: string) {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...editDraft } : r))
    )
    setEditingId(null)
    setEditDraft({})
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
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
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Customer
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Plate Number
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Contact
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Recorded
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-gray-400">
                  No records found.
                </td>
              </tr>
            )}
            {filtered.map((record) => {
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
                          className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                          value={editDraft.fullName ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, fullName: e.target.value }))
                          }
                        />
                      ) : (
                        <div>
                          <p className="font-medium text-gray-800">{record.fullName}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{record.psid}</p>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Plate */}
                  <td className="px-5 py-4">
                    {isEditing ? (
                      <input
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
                        value={editDraft.plateNumber ?? ""}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, plateNumber: e.target.value }))
                        }
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Car className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="font-mono font-medium text-gray-700">
                          {record.plateNumber}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Contact */}
                  <td className="px-5 py-4">
                    {isEditing ? (
                      <input
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                        value={editDraft.contactNumber ?? ""}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, contactNumber: e.target.value }))
                        }
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-gray-700">{record.contactNumber}</span>
                      </div>
                    )}
                  </td>

                  {/* Recorded */}
                  <td className="px-5 py-4 text-gray-400 text-xs">{record.createdAt}</td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveEdit(record.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
