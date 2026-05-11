"use client"

import { useState, useEffect, useCallback } from "react"
import StatusSummaryCards from "./StatusSummaryCards"
import JobCalendarView from "./JobCalendarView"
import QuickAccessPanel from "./QuickAccessPanel"

interface DashboardData {
  status_counts:  Record<string, number>
  concern_count:  number
  recent_jobs:    { id: string; customer: string; service: string; status: string }[]
  calendar_jobs:  any[]
}

export default function OperationsDashboard() {
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/operations/dashboard")
      const json = await res.json()
      if (res.ok) setData(json)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Operations Center</h1>
        <p className="text-sm text-gray-400 mt-0.5">Job management overview and pending actions.</p>
      </div>
      <StatusSummaryCards
        loading={loading}
        counts={data?.status_counts ?? {}}
        concernCount={data?.concern_count ?? 0}
      />
      <div className="grid grid-cols-[1fr_300px] gap-5">
        <JobCalendarView
          loading={loading}
          calendarJobs={data?.calendar_jobs ?? []}
        />
        <QuickAccessPanel
          loading={loading}
          recentJobs={data?.recent_jobs ?? []}
        />
      </div>
    </div>
  )
}
