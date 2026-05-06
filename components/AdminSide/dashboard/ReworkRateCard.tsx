"use client"

import { useCallback, useEffect, useState } from "react"
import { RotateCcw, RefreshCw } from "lucide-react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

type Period = "today" | "week" | "month" | "all"

interface ReworkStats {
  total_completed: number
  rework_count:    number
  rework_rate:     number
  trend:           number | null
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week",  label: "Week"  },
  { key: "month", label: "Month" },
  { key: "all",   label: "All"   },
]

function getSeverity(rate: number): { color: string; bg: string; message: string } {
  if (rate === 0)   return { color: "text-green-600", bg: "bg-green-50",  message: "No rework flagged — excellent service quality." }
  if (rate < 10)    return { color: "text-green-600", bg: "bg-green-50",  message: "Rework rate is within acceptable range." }
  if (rate <= 20)   return { color: "text-amber-600", bg: "bg-amber-50",  message: "Moderate rework rate — monitor for recurring issues." }
  return              { color: "text-red-600",   bg: "bg-red-50",    message: "High rework rate detected — review service workflow." }
}

export function ReworkRateCard() {
  const [period, setPeriod] = useState<Period>("week")
  const [stats, setStats]   = useState<ReworkStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch(`/api/admin/dashboard/rework-rate?period=${period}`)
      if (!res.ok) return
      const json = await res.json()
      setStats(json)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  useRealtimeRefetch(["job_order", "job_order_history"], fetchData)

  const severity = stats ? getSeverity(stats.rework_rate) : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-semibold text-gray-700">Rework Rate Overview</h2>
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Live
        </span>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1.5">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              period === key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !stats || stats.total_completed === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-6">
          No completed jobs in this period.
        </div>
      ) : (
        <>
          {/* Big metric + trend */}
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-4xl font-bold leading-none ${severity!.color}`}>
                {stats.rework_rate}%
              </p>
              <p className="text-xs text-gray-400 mt-1">rework rate</p>
            </div>
            {stats.trend !== null && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded-lg ${
                  stats.trend > 0
                    ? "bg-red-50 text-red-600"
                    : stats.trend < 0
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {stats.trend > 0
                  ? `↑ +${stats.trend}% vs prev period`
                  : stats.trend < 0
                    ? `↓ ${stats.trend}% vs prev period`
                    : "No change"}
              </span>
            )}
          </div>

          {/* Stat chips */}
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-400">Completed</p>
              <p className="text-lg font-bold text-gray-800">{stats.total_completed}</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-400">Reworked</p>
              <p className={`text-lg font-bold ${severity!.color}`}>{stats.rework_count}</p>
            </div>
          </div>

          {/* Insight banner */}
          <div className={`rounded-lg px-3 py-2.5 ${severity!.bg}`}>
            <p className={`text-xs font-medium ${severity!.color}`}>{severity!.message}</p>
          </div>
        </>
      )}
    </div>
  )
}
