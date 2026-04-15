import { Users, Wrench, FileText } from "lucide-react"
import Link from "next/link"

interface AdminStatCardsProps {
  totalAccounts: number
  activeServices: number
  reportsGenerated: number
}

const cardConfig = [
  {
    key: "totalAccounts" as const,
    label: "Total Accounts",
    subLabel: "Active staff and technician accounts",
    icon: Users,
    href: "/dashboard/admin/accounts",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
]

export default function AdminStatCards({
  totalAccounts,
  activeServices,
  reportsGenerated,
}: AdminStatCardsProps) {
  const values = { totalAccounts, activeServices, reportsGenerated }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {cardConfig.map(({ key, label, subLabel, icon: Icon, href, color, bg }) => (
        <Link
          key={key}
          href={href}
          className="group bg-white rounded-xl border border-gray-100 p-6 flex flex-col gap-3 transition-all hover:shadow-md hover:border-gray-200 active:scale-[0.98]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium group-hover:text-gray-700 transition-colors">
                {label}
              </p>
              <p className="text-4xl font-bold text-gray-800 mt-2">
                {values[key]}
              </p>
              <p className="text-xs text-gray-400 mt-1">{subLabel}</p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}
            >
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
