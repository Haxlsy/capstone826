"use client"

import { PageHeader } from "@/components/ui/PageHeader"
import StatusSummaryCards from "./StatusSummaryCards"
import JobCalendarView from "./JobCalendarView"
import QuickAccessPanel from "./QuickAccessPanel"

interface DashboardData {
  status_counts: Record<string, number>
  concern_count: number
  recent_jobs: { id: string; display_id: string; customer: string; service: string; status: string; is_overdue: boolean }[]
  calendar_jobs: any[]
}

export default function OperationsDashboard(props: DashboardData) {
  const { calendar_jobs, concern_count, recent_jobs, status_counts } = props
  return (
    <div className="space-y-5">
      <PageHeader
        title="Operations Center"
        subtitle="Job management overview and pending actions."
      />
      <StatusSummaryCards
        loading={false}
        counts={status_counts ?? {}}
        concernCount={concern_count ?? 0}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <JobCalendarView loading={false} calendarJobs={calendar_jobs ?? []} />
        <QuickAccessPanel loading={false} recentJobs={recent_jobs ?? []} />
      </div>
    </div>
  )
}
