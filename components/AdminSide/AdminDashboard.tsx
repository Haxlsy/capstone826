import { SummaryCards } from "./dashboard/SummaryCards"
import { ShopPerformanceChart } from "./dashboard/ShopPerformanceChart"
import { DelayedJobsTable } from "./dashboard/DelayedJobsTable"
import { ReworkRateCard } from "./dashboard/ReworkRateCard"

export default function AdminDashboard() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">{today}</p>
      </div>

      {/* Summary cards */}
      <SummaryCards />

      {/* Service popularity bar chart */}
      <ShopPerformanceChart />

      {/* Delayed jobs + technician availability */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DelayedJobsTable />
        <ReworkRateCard />
      </div>
    </div>
  )
}
