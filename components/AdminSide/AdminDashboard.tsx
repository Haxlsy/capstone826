import AdminStatCards from "./AdminStatCards"
import AuditLog from "./AuditLog"

interface AdminDashboardProps {
  totalAccounts:  number
  totalServices:  number
  totalCustomers: number
  activeCustomers: number
}

export default function AdminDashboard({ totalAccounts, totalServices, totalCustomers, activeCustomers }: AdminDashboardProps) {
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

      {/* Stat cards */}
      <AdminStatCards totalAccounts={totalAccounts} totalServices={totalServices} totalCustomers={totalCustomers} activeCustomers={activeCustomers} />

      {/* Audit trail */}
      
    </div>
  )
}
