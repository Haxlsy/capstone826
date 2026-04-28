import { Users, Wrench, ClipboardList } from "lucide-react"
import Link from "next/link"

interface AdminStatCardsProps {
  totalAccounts:      number
  totalServices:      number
  totalInquiries:     number
  inquiriesThisMonth: number
}

export default function AdminStatCards({ totalAccounts, totalServices, totalInquiries, inquiriesThisMonth }: AdminStatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Link
        href="/dashboard/admin/accounts"
        className="group bg-white rounded-xl border border-blue-100 p-5 flex items-center gap-4 transition-all hover:shadow-md hover:border-gray-200 active:scale-[0.98]"
      >
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
          <Users className="w-6 h-6 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Accounts</p>
          <p className="text-3xl font-bold text-gray-800 mt-0.5">{totalAccounts}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">Active staff &amp; technician accounts</p>
        </div>
      </Link>

      <Link
        href="/dashboard/admin/services"
        className="group bg-white rounded-xl border border-violet-100 p-5 flex items-center gap-4 transition-all hover:shadow-md hover:border-gray-200 active:scale-[0.98]"
      >
        <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
          <Wrench className="w-6 h-6 text-violet-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Services</p>
          <p className="text-3xl font-bold text-gray-800 mt-0.5">{totalServices}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">Active services available</p>
        </div>
      </Link>

      <div className="bg-white rounded-xl border border-emerald-100 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <ClipboardList className="w-6 h-6 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total Inquiries</p>
          <p className="text-3xl font-bold text-gray-800 mt-0.5">{totalInquiries}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {inquiriesThisMonth > 0 ? `+${inquiriesThisMonth} new this month` : "None this month"}
          </p>
        </div>
      </div>
    </div>
  )
}
