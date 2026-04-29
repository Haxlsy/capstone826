import { Users, Wrench, UserCheck } from "lucide-react"

interface AdminStatCardsProps {
  totalAccounts:  number
  totalServices:  number
  totalCustomers: number
  activeCustomers: number
}

export default function AdminStatCards({ totalAccounts, totalServices, totalCustomers, activeCustomers }: AdminStatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border border-blue-100 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Users className="w-6 h-6 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Accounts</p>
          <p className="text-3xl font-bold text-gray-800 mt-0.5">{totalAccounts}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">Active staff &amp; technician accounts</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-violet-100 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
          <Wrench className="w-6 h-6 text-violet-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Services</p>
          <p className="text-3xl font-bold text-gray-800 mt-0.5">{totalServices}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">Active services available</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-teal-100 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
          <UserCheck className="w-6 h-6 text-teal-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Customer Records</p>
          <p className="text-3xl font-bold text-gray-800 mt-0.5">{totalCustomers}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {activeCustomers > 0 ? `${activeCustomers} currently being serviced` : "No active customers"}
          </p>
        </div>
      </div>
    </div>
  )
}
