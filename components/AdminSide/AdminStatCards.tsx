import { Users, Wrench, FileText } from "lucide-react"

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
  },
  {
    key: "activeServices" as const,
    label: "Active Services",
    subLabel: "Services currently offered",
    icon: Wrench,
  },
  {
    key: "reportsGenerated" as const,
    label: "Reports Generated",
    subLabel: "This month",
    icon: FileText,
  },
]

export default function AdminStatCards({
  totalAccounts,
  activeServices,
  reportsGenerated,
}: AdminStatCardsProps) {
  const values = { totalAccounts, activeServices, reportsGenerated }

  return (
    <div className="grid grid-cols-3 gap-5">
      {cardConfig.map(({ key, label, subLabel, icon: Icon }) => (
        <div
          key={key}
          className="bg-white rounded-xl border border-gray-100 p-6 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">{label}</p>
              <p className="text-4xl font-bold text-gray-800 mt-2">
                {values[key]}
              </p>
              <p className="text-xs text-gray-400 mt-1">{subLabel}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
