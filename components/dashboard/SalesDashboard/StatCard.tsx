import { ArrowRight, type LucideIcon } from "lucide-react"

interface StatCardProps {
  count: number
  title: string
  description: string
  icon: LucideIcon
  color: "blue" | "orange" | "red"
}

const colorMap = {
  blue: {
    border: "border-blue-400",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  orange: {
    border: "border-orange-400",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  red: {
    border: "border-red-300",
    iconBg: "bg-red-50",
    iconColor: "text-red-400",
  },
}

export default function StatCard({ count, title, description, icon: Icon, color }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div
      className={`bg-white rounded-2xl border-2 ${c.border} p-6 flex flex-col gap-5 cursor-pointer hover:shadow-sm transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.iconColor}`} />
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300" />
      </div>
      <div>
        <div className="text-4xl font-bold text-gray-800">{count}</div>
        <div className="text-sm font-semibold text-gray-700 mt-1">{title}</div>
        <div className="text-xs text-gray-400 mt-0.5">{description}</div>
      </div>
    </div>
  )
}
