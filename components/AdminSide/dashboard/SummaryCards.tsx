"use client"

import { useCallback, useEffect, useState } from "react"
import { Briefcase, MessageSquare, RefreshCw } from "lucide-react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

interface DashboardData {
  activeJobCount: number
  maxCapacity: number
  chatbotEfficiency: number
}

export function SummaryCards({ initialData }: { initialData?: DashboardData }) {
  const [data, setData] = useState<DashboardData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard")
      if (!res.ok) return
      const json = await res.json()
      setData({
        activeJobCount: json.activeJobCount,
        maxCapacity: json.maxCapacity,
        chatbotEfficiency: json.chatbotEfficiency,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!initialData) fetchData() }, [fetchData, initialData])
  useRealtimeRefetch(["job_order", "inquiry", "shop_config"], fetchData)

  const capacityPct = data ? Math.min((data.activeJobCount / data.maxCapacity) * 100, 100) : 0
  const capacityColor =
    capacityPct >= 90 ? "bg-status-delayed/100" :
    capacityPct >= 70 ? "bg-status-warning" :
    "bg-status-inspection/100"

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-surface rounded-card border border-border p-5 animate-pulse">
            <div className="h-4 w-32 bg-surface-muted rounded mb-3" />
            <div className="h-8 w-20 bg-surface-muted rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-surface rounded-card border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-body">
            <Briefcase className="w-4 h-4" />
            Active Jobs
          </div>
          <span className="text-xs text-muted flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Live
          </span>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-heading">{data?.activeJobCount ?? 0}</span>
          <span className="text-lg text-muted mb-0.5">/ {data?.maxCapacity ?? 15}</span>
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Capacity</span>
            <span>{Math.round(capacityPct)}%</span>
          </div>
          <div className="w-full bg-surface-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${capacityColor}`}
              style={{ width: `${capacityPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-card border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-body">
            <MessageSquare className="w-4 h-4" />
            AI Chatbot Efficiency
          </div>
          <span className="text-xs text-muted flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Live
          </span>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-heading">{data?.chatbotEfficiency ?? 0}</span>
          <span className="text-lg text-muted mb-0.5">%</span>
        </div>
        <p className="text-xs text-muted">Conversations handled by Gemini without human escalation</p>
      </div>
    </div>
  )
}
