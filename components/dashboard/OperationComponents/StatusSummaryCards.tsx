"use client"

import { useState, useEffect } from "react"

const STATUS_CONFIG = [
  { key: "pending",      label: "Pending",        borderColor: "border-l-4 border-amber-400",  countColor: "text-amber-600",  bg: "bg-amber-50/30"  },
  { key: "ongoing",      label: "Ongoing",         borderColor: "border-l-4 border-blue-400",   countColor: "text-blue-600",   bg: "bg-blue-50/30"   },
  { key: "for_rework",   label: "For Rework",      borderColor: "border-l-4 border-orange-400", countColor: "text-orange-500", bg: "bg-orange-50/30" },
  { key: "for_release",  label: "For Release",     borderColor: "border-l-4 border-green-500",  countColor: "text-green-600",  bg: "bg-green-50/30"  },
  { key: "released",     label: "Released",        borderColor: "border-l-4 border-teal-400",   countColor: "text-teal-600",   bg: "bg-teal-50/30"   },
  { key: "delayed",      label: "Delayed",         borderColor: "border-l-4 border-red-400",    countColor: "text-red-500",    bg: "bg-red-50/30"    },
]

export default function StatusSummaryCards() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [concernCount, setConcernCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/operations/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.status_counts) setCounts(json.status_counts)
        if (typeof json.concern_count === "number") setConcernCount(json.concern_count)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="grid grid-cols-7 gap-3">
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
      {/* Concerns count */}
      <div className="bg-purple-50/30 rounded-xl p-4 border border-l-4 border-purple-400">
        <p className="text-2xl font-bold text-purple-600">
          {loading ? "—" : concernCount}
        </p>
        <p className="text-xs text-gray-500 mt-1">Concerns</p>
      </div>
    </div>
  )
}
