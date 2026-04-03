"use client"

import { useState, useEffect } from "react"
import { Search, Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react"

interface VehicleType {
  vehicle_type_id: number
  type_name: string
  description: string | null
  is_active: boolean
}

interface ModalState {
  open: boolean
  editing: VehicleType | null
}

export default function VehicleTypeTable() {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [modal, setModal] = useState<ModalState>({ open: false, editing: null })

  // Form state
  const [typeName, setTypeName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/vehicle-types")
      const json = await res.json()
      if (res.ok) setVehicleTypes(json.vehicle_types ?? [])
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setTypeName("")
    setDescription("")
    setFormError(null)
    setModal({ open: true, editing: null })
  }

  function openEdit(vt: VehicleType) {
    setTypeName(vt.type_name)
    setDescription(vt.description ?? "")
    setFormError(null)
    setModal({ open: true, editing: vt })
  }

  function closeModal() {
    setModal({ open: false, editing: null })
  }

  async function handleSave() {
    if (!typeName.trim()) { setFormError("Type name is required."); return }
    setSaving(true)
    setFormError(null)
    try {
      const isEdit = modal.editing !== null
      const url = isEdit ? `/api/admin/vehicle-types/${modal.editing!.vehicle_type_id}` : "/api/admin/vehicle-types"
      const method = isEdit ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type_name: typeName, description }),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? "Failed to save."); return }

      if (isEdit) {
        setVehicleTypes((prev) => prev.map((v) => v.vehicle_type_id === json.vehicle_type.vehicle_type_id ? json.vehicle_type : v))
      } else {
        setVehicleTypes((prev) => [json.vehicle_type, ...prev])
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(vt: VehicleType) {
    const res = await fetch(`/api/admin/vehicle-types/${vt.vehicle_type_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !vt.is_active }),
    })
    const json = await res.json()
    if (res.ok) {
      setVehicleTypes((prev) => prev.map((v) => v.vehicle_type_id === json.vehicle_type.vehicle_type_id ? json.vehicle_type : v))
    }
  }

  const filtered = vehicleTypes.filter((v) =>
    v.type_name.toLowerCase().includes(search.toLowerCase()) ||
    (v.description ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 flex flex-col gap-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Vehicle Types</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage the vehicle types used across the system.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle Type
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search vehicle types..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">No vehicle types found.</td></tr>
            ) : filtered.map((vt) => (
              <tr key={vt.vehicle_type_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-800">{vt.type_name}</td>
                <td className="px-5 py-3.5 text-gray-500">{vt.description || <span className="italic text-gray-300">—</span>}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${vt.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    {vt.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(vt)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-blue-300 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(vt)}
                      className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition-colors ${
                        vt.is_active
                          ? "text-gray-500 hover:text-red-600 border-gray-200 hover:border-red-300"
                          : "text-gray-500 hover:text-green-600 border-gray-200 hover:border-green-300"
                      }`}
                    >
                      {vt.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      {vt.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-5">
              {modal.editing ? "Edit Vehicle Type" : "Add Vehicle Type"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  placeholder="e.g. SUV, Sedan, Pickup Truck"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description <span className="text-gray-300">(optional)</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this vehicle type..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition resize-none"
                />
              </div>
              {formError && (
                <p className="text-xs text-red-500">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : modal.editing ? "Save Changes" : "Add Type"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
