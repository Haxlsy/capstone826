import { TIME_ZONE } from "@/lib/time-display"
import { SummaryCards } from "./dashboard/SummaryCards"
import { ShopPerformanceChart } from "./dashboard/ShopPerformanceChart"
import { DelayedJobsTable } from "./dashboard/DelayedJobsTable"
import { TechnicianAvailability } from "./dashboard/TechnicianAvailability"

export default function AdminDashboard({
  initialSummary,
  initialDelayedJobs,
  initialServiceBreakdown,
}: {
  initialSummary: { activeJobCount: number; maxCapacity: number; chatbotEfficiency: number }
  initialDelayedJobs: { id: string; job_order_code: string; status: string; expected_completion_at: string | null; service: { name: string } | null }[]
  initialServiceBreakdown: { service_name: string; count: number }[]
}) {
  // Server component (UTC on Vercel): pin the shop's zone or the heading shows
  // yesterday between midnight and 8 AM Manila.
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TIME_ZONE,
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">{today}</p>
      </div>

      <SummaryCards initialData={initialSummary} />

      <ShopPerformanceChart initialData={initialServiceBreakdown} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DelayedJobsTable initialData={initialDelayedJobs} />
        <TechnicianAvailability />
      </div>
    </div>
  )
}
