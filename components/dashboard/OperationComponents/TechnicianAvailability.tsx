"use client"

import { useState, useEffect } from "react"
import { UserCheck } from "lucide-react"

interface Technician {
  id: string
  name: string
  role: "detailer" | "head_detailer"
  available: boolean
}

const MOCK_TECHNICIANS: Technician[] = [
  { id: "1", name: "Juan Dela Cruz", role: "head_detailer", available: true },
  { id: "2", name: "Mark Santos",    role: "detailer",      available: true },
  { id: "3", name: "Leo Reyes",      role: "detailer",      available: false },
  { id: "4", name: "Renz Bautista",  role: "detailer",      available: true },
  { id: "5", name: "Paolo Lim",      role: "detailer",      available: false },
]

const ROLE_LABEL: Record<Technician["role"], string> = {
  head_detailer: "Head Detailer",
  detailer: "Detailer",
}

export default function TechnicianAvailability() {
  const [technicians, setTechnicians] = useState<Technician[]>(MOCK_TECHNICIANS)

  function toggle(id: string) {
    setTechnicians((prev) =>
      prev.map((t) => (t.id === id ? { ...t, available: !t.available } : t))
    )
  }

  const availableCount = technicians.filter((t) => t.available).length

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-sm text-gray-800">Technician Availability</span>
        </div>
        <span className="text-xs text-gray-400">
          {availableCount}/{technicians.length} available
        </span>
      </div>

      <div className="flex flex-col divide-y divide-gray-50">
        {technicians.map((tech) => (
          <div key={tech.id} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  tech.available ? "bg-green-400" : "bg-gray-300"
                }`}
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{tech.name}</p>
                <p className="text-[11px] text-gray-400">{ROLE_LABEL[tech.role]}</p>
              </div>
            </div>

            <button
              onClick={() => toggle(tech.id)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                tech.available ? "bg-green-400" : "bg-gray-200"
              }`}
              role="switch"
              aria-checked={tech.available}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  tech.available ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
