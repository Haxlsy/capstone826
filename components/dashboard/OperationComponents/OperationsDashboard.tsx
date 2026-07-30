"use client"

import StatusSummaryCards from "./StatusSummaryCards"
import JobCalendarView from "./JobCalendarView"
import QuickAccessPanel from "./QuickAccessPanel"

interface DashboardData {
  status_counts:  Record<string, number>
  concern_count:  number
  recent_jobs:    { id: string; display_id: string; customer: string; service: string; status: string }[]
  calendar_jobs:  any[]
}

export default function OperationsDashboard(props: DashboardData) {

  const {calendar_jobs, concern_count, recent_jobs, status_counts} = props
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Operations Center</h1>
        <p className="text-sm text-gray-400 mt-0.5">Job management overview and pending actions.</p>
      </div>
      <StatusSummaryCards
        loading={false}
        counts={status_counts ?? {}}
        concernCount={concern_count ?? 0}
      />
      <div className="grid grid-cols-[1fr_300px] gap-5">
        <JobCalendarView
          loading={false}
          calendarJobs={calendar_jobs ?? []}
        />
        <QuickAccessPanel
          loading={false}
          recentJobs={recent_jobs ?? []}
        />
      </div>
    </div>
  )
}
