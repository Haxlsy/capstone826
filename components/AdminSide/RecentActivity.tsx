export interface ActivityItem {
  id: string
  description: string
  timestamp: string
  type: "account" | "service" | "report" | "other"
}

interface RecentActivityProps {
  items: ActivityItem[]
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

const typeColorMap: Record<ActivityItem["type"], string> = {
  account: "text-blue-600",
  service: "text-blue-600",
  report: "text-gray-800",
  other: "text-gray-800",
}

export default function RecentActivity({ items }: RecentActivityProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-4">
        Recent Activity
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">No recent activity.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-3"
            >
              <p className={`text-sm font-medium ${typeColorMap[item.type]}`}>
                {item.description}
              </p>
              <span className="text-xs text-gray-400 shrink-0 ml-4">
                {formatTimestamp(item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
