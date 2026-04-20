"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { UserCheck, UserX, Users, Search, Plus, X, Wrench, Pencil, Trash2, Filter } from "lucide-react"

interface ActiveJob {
  job_id:   string
  customer: string
  service:  string
}

interface Technician {
  id:           string
  full_name:    string
  role:         "detailer" | "installer"
  is_available: boolean
  active_job:   ActiveJob | null
}

const ROLE_LABEL: Record<Technician["role"], string> = {
  detailer:  "Detailer",
  installer: "Installer",
}

const ROLE_BADGE: Record<Technician["role"], string> = {
  detailer:  "bg-blue-50 text-blue-600",
  installer: "bg-teal-50 text-teal-600",
}

const GROUP_ORDER: Technician["role"][] = ["detailer", "installer"]

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-600",
  "bg-purple-100 text-purple-600",
  "bg-teal-100 text-teal-600",
  "bg-amber-100 text-amber-600",
  "bg-pink-100 text-pink-600",
  "bg-indigo-100 text-indigo-600",
  "bg-green-100 text-green-600",
  "bg-orange-100 text-orange-600",
]

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

function colorIdx(id: string) {
  // stable colour derived from UUID characters
  return id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length
}

export default function TechnicianAvailability() {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading]         = useState(true)
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const [search, setSearch]           = useState("")
  const [filterRole, setFilterRole]   = useState<Technician["role"] | "all">("all")

  // Add technician modal
  const [addOpen, setAddOpen]       = useState(false)
  const [newName, setNewName]       = useState("")
  const [newRole, setNewRole]       = useState<Technician["role"]>("detailer")
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState<string | null>(null)

  // Edit technician modal
  const [editOpen, setEditOpen]       = useState(false)
  const [editingTech, setEditingTech] = useState<Technician | null>(null)
  const [editName, setEditName]       = useState("")
  const [editRole, setEditRole]       = useState<Technician["role"]>("detailer")
  const [updating, setUpdating]       = useState(false)
  const [editError, setEditError]     = useState<string | null>(null)

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<Technician | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState<string | null>(null)

  // Filter dropdown
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res  = await fetch("/api/operations/technician-availability")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load technicians")
      setTechnicians(json.technicians ?? [])
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(tech: Technician) {
    const next = !tech.is_available
    // Optimistic update
    setTechnicians((prev) => prev.map((t) => t.id === tech.id ? { ...t, is_available: next } : t))
    try {
      const res  = await fetch("/api/operations/technician-availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tech.id, is_available: next }),
      })
      if (!res.ok) {
        // Revert on failure
        setTechnicians((prev) => prev.map((t) => t.id === tech.id ? { ...t, is_available: !next } : t))
      }
    } catch {
      setTechnicians((prev) => prev.map((t) => t.id === tech.id ? { ...t, is_available: !next } : t))
    }
  }

  async function addTechnician() {
    if (!newName.trim()) return
    const duplicate = technicians.some(
      (t) => t.role === newRole && t.full_name.toLowerCase() === newName.trim().toLowerCase()
    )
    if (duplicate) {
      setAddError(`A ${ROLE_LABEL[newRole].toLowerCase()} named "${newName.trim()}" already exists.`)
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const res  = await fetch("/api/operations/technician-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: newName.trim(), role: newRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to add technician")
      setTechnicians((prev) => [...prev, json.technician])
      setAddOpen(false)
      setNewName("")
      setNewRole("detailer")
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  async function updateTechnician() {
    if (!editingTech || !editName.trim()) return
    setUpdating(true)
    setEditError(null)
    try {
      const res  = await fetch("/api/operations/technician-availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTech.id, full_name: editName.trim(), role: editRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to update technician")
      setTechnicians((prev) => prev.map((t) => t.id === editingTech.id ? { ...t, full_name: editName.trim(), role: editRole } : t))
      setEditOpen(false)
      setEditingTech(null)
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : String(err))
    } finally {
      setUpdating(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res  = await fetch("/api/operations/technician-availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id, is_archived: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete technician")
      setTechnicians((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  const onJobCount       = technicians.filter((t) => !!t.active_job).length
  const availableCount   = technicians.filter((t) => t.is_available && !t.active_job).length
  const unavailableCount = technicians.length - availableCount - onJobCount

  const filtered = technicians.filter((t) => {
    const matchSearch = t.full_name.toLowerCase().includes(search.toLowerCase())
    const matchRole   = filterRole === "all" || t.role === filterRole
    return matchSearch && matchRole
  })

  const grouped = GROUP_ORDER.reduce<Record<string, Technician[]>>((acc, role) => {
    const members = filtered.filter((t) => t.role === role)
    if (members.length > 0) acc[role] = members
    return acc
  }, {})

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Technician Availability</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            View and manage which technicians are available for assignment.
          </p>
        </div>
        <button
          onClick={() => { setAddOpen(true); setAddError(null) }}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Technician
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{technicians.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{availableCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Available</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-500">{onJobCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">On Job</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-500">{unavailableCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Unavailable</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search technician..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors"
          />
        </div>
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-lg font-medium transition-colors ${
              filterRole !== "all"
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            {filterRole === "all" ? "Filter" : ROLE_LABEL[filterRole]}
          </button>
          {filterOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-40 bg-white border border-gray-100 rounded-xl shadow-lg z-10 p-2 space-y-0.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">Role</p>
              {(["all", "detailer", "installer"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => { setFilterRole(r); setFilterOpen(false) }}
                  className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                    filterRole === r ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {r === "all" ? "All Roles" : ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-sm text-gray-400">Loading technicians…</div>
      ) : fetchError ? (
        <div className="text-center py-12 text-sm text-red-500">{fetchError}</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([role, members]) => (
            <div key={role} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/60">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_BADGE[role as Technician["role"]]}`}>
                  {ROLE_LABEL[role as Technician["role"]]}
                </span>
                <span className="text-xs text-gray-400">
                  {members.filter((m) => m.active_job).length > 0 && (
                    <span className="text-orange-500 font-medium">
                      {members.filter((m) => m.active_job).length} on job ·{" "}
                    </span>
                  )}
                  {members.filter((m) => m.is_available && !m.active_job).length}/{members.length} available
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {members.map((tech) => {
                  const onJob = !!tech.active_job
                  return (
                    <div key={tech.id} className={`flex items-center gap-4 px-5 py-3.5 ${onJob ? "bg-orange-50/40" : ""}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${AVATAR_COLORS[colorIdx(tech.id)]}`}>
                        {initials(tech.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{tech.full_name}</p>
                        {onJob ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Wrench className="w-3 h-3 text-orange-500 shrink-0" />
                            <span className="text-xs text-orange-600 font-medium truncate">
                              On Job — {tech.active_job?.customer}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tech.is_available ? "bg-green-400" : "bg-gray-300"}`} />
                            <span className="text-xs text-gray-400">
                              {tech.is_available ? "Available" : "Unavailable"}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 group/actions">
                        <button
                          onClick={() => {
                            setEditingTech(tech)
                            setEditName(tech.full_name)
                            setEditRole(tech.role)
                            setEditOpen(true)
                            setEditError(null)
                          }}
                          disabled={onJob}
                          title={onJob ? "Cannot edit while on an active job" : "Edit details"}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-0 disabled:pointer-events-none"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(tech); setDeleteError(null) }}
                          disabled={onJob}
                          title={onJob ? "Cannot delete while on an active job" : "Delete technician"}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-0 disabled:pointer-events-none"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => toggle(tech)}
                        disabled={onJob}
                        title={onJob ? "Cannot change availability while on an active job" : undefined}
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                          onJob
                            ? "bg-orange-300 cursor-not-allowed opacity-70"
                            : tech.is_available
                              ? "bg-green-400 cursor-pointer"
                              : "bg-gray-200 cursor-pointer"
                        }`}
                        role="switch"
                        aria-checked={tech.is_available}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${tech.is_available || onJob ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-400">
              {technicians.length === 0
                ? "No technicians yet. Click \"Add Technician\" to get started."
                : "No technicians match your search."}
            </div>
          )}
        </div>
      )}

      {/* Add Technician Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-800">Add Technician</h3>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Technician["role"])}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="detailer">Detailer</option>
                  <option value="installer">Installer</option>
                </select>
              </div>
            </div>

            {addError && <p className="text-xs text-red-500 mt-3">{addError}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setAddOpen(false)}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addTechnician}
                disabled={adding || !newName.trim()}
                className="flex-1 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-base font-bold text-gray-800">Delete Technician</h2>
              <p className="text-sm text-gray-500 mt-1.5">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-700">{deleteTarget.full_name}</span>?
                This will remove them from active assignment.
              </p>
            </div>
            {deleteError && (
              <p className="mx-5 mb-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>
            )}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null) }}
                disabled={deleting}
                className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Technician Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-800">Edit Technician</h3>
              <button
                onClick={() => {
                  setEditOpen(false)
                  setEditingTech(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Technician["role"])}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="detailer">Detailer</option>
                  <option value="installer">Installer</option>
                </select>
              </div>
            </div>

            {editError && <p className="text-xs text-red-500 mt-3">{editError}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setEditOpen(false)
                  setEditingTech(null)
                }}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateTechnician}
                disabled={updating || !editName.trim()}
                className="flex-1 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {updating ? "Updating…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
