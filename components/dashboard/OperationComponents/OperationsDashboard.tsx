"use client"

import StatusSummaryCards from "./StatusSummaryCards"
import JobCalendarView from "./JobCalendarView"
import QuickAccessPanel from "./QuickAccessPanel"

export default function OperationsDashboard() {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Operations Center</h1>
        <p className="text-sm text-gray-400 mt-0.5">Job management overview and pending actions.</p>
      </div>
      <StatusSummaryCards />
      <div className="grid grid-cols-[1fr_300px] gap-5">
        <JobCalendarView />
        <QuickAccessPanel />
      </div>
    </div>
  )
}
