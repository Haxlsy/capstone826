"use client"

import { PageHeader } from "@/components/ui/PageHeader"
import StatusSummaryCards from "./StatusSummaryCards"
import JobCalendarView from "./JobCalendarView"
import QuickAccessPanel from "./QuickAccessPanel"
import { useOperationsDashboard, type OperationsDashboardData } from "@/hooks/use-dashboard"

export default function OperationsDashboard(props: OperationsDashboardData) {
  // Cached (react-query, 30s staleTime) and realtime-refetched — see
  // hooks/use-dashboard.ts. StatusSummaryCards and JobCalendarView were
  // previously frozen at whatever the server sent on last navigation, with
  // no live updates at all; QuickAccessPanel already self-manages its own
  // freshness and keeps doing so independently.
  const { data } = useOperationsDashboard(props)
  const { calendar_jobs, concern_count, recent_jobs, status_counts } = data ?? props

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
