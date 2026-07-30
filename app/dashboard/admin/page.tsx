import AdminDashboard from "@/components/AdminSide/AdminDashboard"
import { getDashboardSummary, getDelayedJobs, getServiceBreakdown } from "@/lib/admin/dashboard-data"

export default async function AdminPage() {
  const [summary, delayedJobs, serviceBreakdown] = await Promise.all([
    getDashboardSummary(),
    getDelayedJobs(),
    getServiceBreakdown(),
  ])

  return (
    <AdminDashboard
      initialSummary={summary}
      initialDelayedJobs={delayedJobs}
      initialServiceBreakdown={serviceBreakdown}
    />
  )
}
