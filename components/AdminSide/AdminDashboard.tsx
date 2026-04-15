import AdminStatCards from "./AdminStatCards"
import RecentActivity, { ActivityItem } from "./RecentActivity"
import AuditLog from "./AuditLog"

interface AdminDashboardProps {
  totalAccounts: number
  activeServices: number
  reportsGenerated: number
  recentActivity: ActivityItem[]
}

export default function AdminDashboard({
  totalAccounts,
  activeServices,
  reportsGenerated,
  recentActivity,
}: AdminDashboardProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
      </div>
      <AdminStatCards
        totalAccounts={totalAccounts}
        activeServices={activeServices}
        reportsGenerated={reportsGenerated}
      />
      <RecentActivity items={recentActivity} />
      <AuditLog />
    </div>
  )
}
