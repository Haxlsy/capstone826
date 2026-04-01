"use client"

import { useState } from "react"
import { Search } from "lucide-react"

const jobOrders = [
  {
    id: "JO-2026-0412",
    name: "Ricardo Santos",
    plate: "ABC 1234",
    due: "Apr 2, 2026",
    status: "Ongoing",
  },
  {
    id: "JO-2026-0408",
    name: "Kenneth Ong",
    plate: "JKL 7890",
    due: "Mar 27, 2026",
    status: "Delayed",
  },
  {
    id: "JO-2026-0411",
    name: "Maria Cruz",
    plate: "XYZ 5678",
    due: "Apr 1, 2026",
    status: "Quality Check",
  },
  {
    id: "JO-2026-0406",
    name: "David Villanueva",
    plate: "PQR 5678",
    due: "Apr 3, 2026",
    status: "Ongoing",
  },
]

const statusStyle: Record<string, string> = {
  Ongoing: "bg-blue-100 text-blue-600",
  Delayed: "bg-red-100 text-red-500",
  "Quality Check": "bg-orange-100 text-orange-500",
}

export default function QuickStatusLookup() {
  const [query, setQuery] = useState("")

  const filtered = jobOrders.filter(
    (j) =>
      j.name.toLowerCase().includes(query.toLowerCase()) ||
      j.plate.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Quick Status Lookup</h2>
        <button className="text-sm text-blue-500 hover:text-blue-700 font-medium transition-colors">
          View All →
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plate no. or customer name..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((j) => (
          <div
            key={j.id}
            className="p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400 font-mono">{j.id}</span>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusStyle[j.status]}`}>
                {j.status}
              </span>
            </div>
            <div className="text-sm font-semibold text-gray-800">{j.name}</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs text-gray-400">{j.plate}</span>
              <span className="text-xs text-gray-400">Due: {j.due}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
