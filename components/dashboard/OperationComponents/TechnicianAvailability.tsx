"use client"

import { useState } from "react"
import { UserCheck, UserX, Users, Search } from "lucide-react"

interface Technician {
  id: string
  name: string
  role: "head_detailer" | "detailer" | "head_installer" | "installer"
  available: boolean
}

const MOCK_TECHNICIANS: Technician[] = [
  { id: "1", name: "Juan Dela Cruz",  role: "head_detailer",  available: true },
  { id: "2", name: "Mark Santos",     role: "detailer",       available: true },
  { id: "3", name: "Leo Reyes",       role: "detailer",       available: false },
  { id: "4", name: "Renz Bautista",   role: "detailer",       available: true },
  { id: "5", name: "Paolo Lim",       role: "detailer",       available: false },
  { id: "6", name: "Carlo Mendoza",   role: "head_installer", available: true },
  { id: "7", name: "Nico Torres",     role: "installer",      available: true },
  { id: "8", name: "Dino Aguilar",    role: "installer",      available: false },
]

const ROLE_LABEL: Record<Technician["role"], string> = {
  head_detailer:  "Head Detailer",
  detailer:       "Detailer",
  head_installer: "Head Installer",
  installer:      "Installer",
}

const ROLE_BADGE: Record<Technician["role"], string> = {
  head_detailer:  "bg-purple-50 text-purple-600",
  detailer:       "bg-blue-50 text-blue-600",
  head_installer: "bg-amber-50 text-amber-600",
  installer:      "bg-teal-50 text-teal-600",
}

const GROUP_ORDER: Technician["role"][] = [
  "head_detailer",
  "detailer",
  "head_installer",
  "installer",
]

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

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

export default function TechnicianAvailability() {
  const [technicians, setTechnicians] = useState<Technician[]>(MOCK_TECHNICIANS)
  const [search, setSearch] = useState("")
  const [filterRole, setFilterRole] = useState<Technician["role"] | "all">("all")

  function toggle(id: string) {
    setTechnicians((prev) =>
      prev.map((t) => (t.id === id ? { ...t, available: !t.available } : t))
    )
  }

  const availableCount = technicians.filter((t) => t.available).length
  const unavailableCount = technicians.length - availableCount

  const filtered = technicians.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === "all" || t.role === filterRole
    return matchSearch && matchRole
  })

  // Group by role in defined order
  const grouped = GROUP_ORDER.reduce<Record<string, Technician[]>>((acc, role) => {
    const members = filtered.filter((t) => t.role === role)
    if (members.length > 0) acc[role] = members
    return acc
  }, {})

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Technician Availability</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          View and manage which technicians are available for assignment.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
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
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as Technician["role"] | "all")}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors"
        >
          <option value="all">All Roles</option>
          <option value="head_detailer">Head Detailer</option>
          <option value="detailer">Detailer</option>
          <option value="head_installer">Head Installer</option>
          <option value="installer">Installer</option>
        </select>
      </div>

      {/* Grouped table */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([role, members]) => (
          <div key={role} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Group header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/60">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_BADGE[role as Technician["role"]]}`}>
                {ROLE_LABEL[role as Technician["role"]]}
              </span>
              <span className="text-xs text-gray-400">
                {members.filter((m) => m.available).length}/{members.length} available
              </span>
            </div>

            {/* Members */}
            <div className="divide-y divide-gray-50">
              {members.map((tech, idx) => (
                <div key={tech.id} className="flex items-center gap-4 px-5 py-3.5">
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      AVATAR_COLORS[parseInt(tech.id) % AVATAR_COLORS.length]
                    }`}
                  >
                    {initials(tech.name)}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{tech.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          tech.available ? "bg-green-400" : "bg-gray-300"
                        }`}
                      />
                      <span className="text-xs text-gray-400">
                        {tech.available ? "Available" : "Unavailable"}
                      </span>
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => toggle(tech.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      tech.available ? "bg-green-400" : "bg-gray-200"
                    }`}
                    role="switch"
                    aria-checked={tech.available}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        tech.available ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">
            No technicians found.
          </div>
        )}
      </div>
    </div>
  )
}
