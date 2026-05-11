"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { BarChart2, RefreshCw } from "lucide-react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

type Period = "today" | "week" | "month" | "overall"

const PERIODS: { key: Period; label: string }[] = [
  { key: "today",   label: "Today" },
  { key: "week",    label: "This Week" },
  { key: "month",   label: "This Month" },
  { key: "overall", label: "Overall" },
]

interface ServiceBreakdown {
  service_name: string
  count: number
}

export function ShopPerformanceChart() {
  const [period, setPeriod]   = useState<Period>("overall")
  const [data, setData]       = useState<ServiceBreakdown[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/dashboard/service-breakdown?period=${p}`)
      if (!res.ok) return
      const json = await res.json()
      setData(json.breakdown ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(period) }, [fetchData, period])
  useRealtimeRefetch("job_order", () => fetchData(period))

  function handlePeriod(p: Period) {
    setPeriod(p)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-700">Shop Performance — Service Type Popularity</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Period filter pills */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handlePeriod(key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  period === key
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="text-xs text-gray-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Live
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-56 animate-pulse bg-gray-100 rounded-lg" />
      ) : data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-gray-400">
          No job data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="service_name"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(value) => [String(value), "Jobs"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60} fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
