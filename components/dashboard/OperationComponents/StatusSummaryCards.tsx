const statusCards = [
  {
    label: "Pending",
    count: 5,
    borderColor: "border-l-4 border-amber-400",
    countColor: "text-amber-600",
    bg: "bg-amber-50/30",
  },
  {
    label: "Ongoing",
    count: 8,
    borderColor: "border-l-4 border-blue-400",
    countColor: "text-blue-600",
    bg: "bg-blue-50/30",
  },
  {
    label: "Quality Check",
    count: 3,
    borderColor: "border-l-4 border-orange-400",
    countColor: "text-orange-500",
    bg: "bg-orange-50/30",
  },
  {
    label: "Completed",
    count: 12,
    borderColor: "border-l-4 border-green-500",
    countColor: "text-green-600",
    bg: "bg-green-50/30",
  },
  {
    label: "Delayed",
    count: 2,
    borderColor: "border-l-4 border-red-400",
    countColor: "text-red-500",
    bg: "bg-red-50/30",
  },
  {
    label: "Released",
    count: 7,
    borderColor: "border-l-4 border-teal-400",
    countColor: "text-teal-600",
    bg: "bg-teal-50/30",
  },
]

export default function StatusSummaryCards() {
  return (
    <div className="grid grid-cols-6 gap-3">
      {statusCards.map(({ label, count, borderColor, countColor, bg }) => (
        <div
          key={label}
          className={`bg-white rounded-xl p-4 border border-gray-100 ${borderColor} ${bg}`}
        >
          <p className={`text-2xl font-bold ${countColor}`}>{count}</p>
          <p className="text-xs text-gray-500 mt-1">{label}</p>
        </div>
      ))}
    </div>
  )
}
