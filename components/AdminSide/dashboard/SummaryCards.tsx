"use client"

import { useCallback, useEffect, useState } from "react"
import { Briefcase, MessageSquare, RefreshCw } from "lucide-react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

interface DashboardData {
  activeJobCount: number
  maxCapacity: number
  chatbotEfficiency: number
}

export function SummaryCards() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => { fetchData() }, [fetchData])
  useRealtimeRefetch(["job_order", "inquiry", "shop_config"], fetchData)

  const capacityPct = data ? Math.min((data.activeJobCount / data.maxCapacity) * 100, 100) : 0
  const capacityColor =
    capacityPct >= 90 ? "bg-red-500" :
    capacityPct >= 70 ? "bg-yellow-500" :
    "bg-green-500"

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
            <div className="h-8 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Active Jobs / Capacity */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <Briefcase className="w-4 h-4" />
            Active Jobs
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Live
          </span>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-gray-900">{data?.activeJobCount ?? 0}</span>
          <span className="text-lg text-gray-400 mb-0.5">/ {data?.maxCapacity ?? 15}</span>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Capacity</span>
            <span>{Math.round(capacityPct)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${capacityColor}`}
              style={{ width: `${capacityPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* AI Chatbot Efficiency */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <MessageSquare className="w-4 h-4" />
            AI Chatbot Efficiency
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Live
          </span>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-gray-900">{data?.chatbotEfficiency ?? 0}</span>
          <span className="text-lg text-gray-400 mb-0.5">%</span>
        </div>
        <p className="text-xs text-gray-400">Conversations handled by Gemini without human escalation</p>
      </div>
    </div>
  )
}
