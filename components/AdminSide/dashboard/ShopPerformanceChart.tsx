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

export function ShopPerformanceChart({ initialData }: { initialData?: ServiceBreakdown[] }) {
  const [period, setPeriod]   = useState<Period>("overall")
  const [data, setData]       = useState<ServiceBreakdown[]>(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)

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

  useEffect(() => { if (!initialData) fetchData(period) }, [fetchData, period, initialData])
  useRealtimeRefetch("job_order", () => fetchData(period))

  function handlePeriod(p: Period) {
    setPeriod(p)
    fetchData(p)
  }

  return (
    <div className="bg-surface rounded-card border border-border p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-status-ongoing" />
          <h2 className="text-sm font-semibold text-body">Shop Performance — Service Type Popularity</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface-muted rounded-sm p-0.5">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handlePeriod(key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  period === key
                    ? "bg-surface text-heading shadow-sm"
                    : "text-body hover:text-body"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="text-xs text-muted flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Live
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-56 animate-pulse bg-surface-muted rounded-sm" />
      ) : data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-muted">
          No job data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
            <XAxis
              dataKey="service_name"
              tick={{ fontSize: 12, fill: "var(--color-chart-axis)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "var(--color-chart-axis)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid var(--color-chart-tooltip-border)", background: "var(--color-surface)", color: "var(--color-heading)" }}
              formatter={(value) => [String(value), "Jobs"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60} fill="var(--color-chart-1)" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
