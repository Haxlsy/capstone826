import StatCard from "./dashboard/SalesDashboard/StatCard"
import RecentConversations from "./dashboard/SalesDashboard/RecentConversations"
import QuickStatusLookup from "./dashboard/SalesDashboard/QuickStatusLookup"
import { MessageCircle, Car, AlertTriangle } from "lucide-react"

export default function Sales() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Sales Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Overview of customer communications and pending actions.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-5">
        <StatCard
          count={4}
          title="Messenger Inbox"
          description="Conversations awaiting response."
          icon={MessageCircle}
          color="blue"
        />
        <StatCard
          count={3}
          title="Vehicle Status Inquiries"
          description="Customers waiting for status update."
          icon={Car}
          color="orange"
        />
        <StatCard
          count={2}
          title="Delay Notifications"
          description="Delayed jobs — customer not yet notified."
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-2 gap-5">
        <RecentConversations />
        <QuickStatusLookup />
      </div>
    </div>
  )
}
