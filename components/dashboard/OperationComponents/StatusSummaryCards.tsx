"use client"

import { useState, useEffect } from "react"

const STATUS_CONFIG = [
  { key: "pending",       label: "Pending",       borderColor: "border-l-4 border-amber-400",  countColor: "text-amber-600",  bg: "bg-amber-50/30"  },
  { key: "ongoing",       label: "Ongoing",       borderColor: "border-l-4 border-blue-400",   countColor: "text-blue-600",   bg: "bg-blue-50/30"   },
  { key: "quality_check", label: "Quality Check", borderColor: "border-l-4 border-orange-400", countColor: "text-orange-500", bg: "bg-orange-50/30" },
  { key: "completed",     label: "Completed",     borderColor: "border-l-4 border-green-500",  countColor: "text-green-600",  bg: "bg-green-50/30"  },
  { key: "delayed",       label: "Delayed",       borderColor: "border-l-4 border-red-400",    countColor: "text-red-500",    bg: "bg-red-50/30"    },
  { key: "released",      label: "Released",      borderColor: "border-l-4 border-teal-400",   countColor: "text-teal-600",   bg: "bg-teal-50/30"   },
]

export default function StatusSummaryCards() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/operations/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.status_counts) setCounts(json.status_counts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="grid grid-cols-6 gap-3">
      {STATUS_CONFIG.map(({ key, label, borderColor, countColor, bg }) => (
        <div
          key={key}
          className={`bg-white rounded-xl p-4 border border-gray-100 ${borderColor} ${bg}`}
        >
          <p className={`text-2xl font-bold ${countColor}`}>
            {loading ? "—" : (counts[key] ?? 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{label}</p>
        </div>
      ))}
    </div>
  )
}
