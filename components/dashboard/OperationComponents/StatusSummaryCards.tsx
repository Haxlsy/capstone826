"use client"

import { useState, useEffect } from "react"
import {
  Clock,
  Wrench,
  RefreshCw,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  MessageCircleWarning,
} from "lucide-react"

const STATUS_CONFIG = [
  {
    key:         "pending",
    label:       "Pending",
    icon:        Clock,
    border:      "border-l-4 border-amber-400",
    countColor:  "text-amber-600",
    bg:          "bg-amber-50/40",
    iconBg:      "bg-amber-100",
    iconColor:   "text-amber-500",
  },
  {
    key:         "ongoing",
    label:       "Ongoing",
    icon:        Wrench,
    border:      "border-l-4 border-blue-400",
    countColor:  "text-blue-600",
    bg:          "bg-blue-50/40",
    iconBg:      "bg-blue-100",
    iconColor:   "text-blue-500",
  },
  {
    key:         "for_rework",
    label:       "For Rework",
    icon:        RefreshCw,
    border:      "border-l-4 border-orange-400",
    countColor:  "text-orange-500",
    bg:          "bg-orange-50/40",
    iconBg:      "bg-orange-100",
    iconColor:   "text-orange-500",
  },
  {
    key:         "for_release",
    label:       "For Release",
    icon:        PackageCheck,
    border:      "border-l-4 border-green-500",
    countColor:  "text-green-600",
    bg:          "bg-green-50/40",
    iconBg:      "bg-green-100",
    iconColor:   "text-green-500",
  },
  {
    key:         "released",
    label:       "Released",
    icon:        CheckCircle2,
    border:      "border-l-4 border-teal-400",
    countColor:  "text-teal-600",
    bg:          "bg-teal-50/40",
    iconBg:      "bg-teal-100",
    iconColor:   "text-teal-500",
  },
  {
    key:         "delayed",
    label:       "Delayed",
    icon:        AlertTriangle,
    border:      "border-l-4 border-red-400",
    countColor:  "text-red-500",
    bg:          "bg-red-50/40",
    iconBg:      "bg-red-100",
    iconColor:   "text-red-400",
  },
]

export default function StatusSummaryCards() {
  const [counts, setCounts]           = useState<Record<string, number>>({})
  const [concernCount, setConcernCount] = useState<number>(0)
  const [loading, setLoading]         = useState(true)

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
      {STATUS_CONFIG.map(({ key, label, icon: Icon, border, countColor, bg, iconBg, iconColor }) => (
        <div
          key={key}
          className={`bg-white rounded-xl p-4 border border-gray-100 ${border} ${bg} flex flex-col gap-3`}
        >
          <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2} />
          </div>
          <div>
            <p className={`text-2xl font-bold leading-none ${countColor}`}>
              {loading ? "—" : (counts[key] ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1.5 font-medium">{label}</p>
          </div>
        </div>
      ))}

      {/* Concerns */}
      <div className="bg-purple-50/40 rounded-xl p-4 border border-gray-100 border-l-4 border-l-purple-400 flex flex-col gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
          <MessageCircleWarning className="w-4 h-4 text-purple-500" strokeWidth={2} />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none text-purple-600">
            {loading ? "—" : concernCount}
          </p>
          <p className="text-xs text-gray-400 mt-1.5 font-medium">Concerns</p>
        </div>
      </div>
    </div>
  )
}
