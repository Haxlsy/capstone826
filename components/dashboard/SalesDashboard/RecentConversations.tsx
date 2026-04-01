const conversations = [
  {
    id: 1,
    name: "Juan Dela Cruz",
    initials: "JD",
    preview: "Hi, I'd like to know when my car will be ready...",
    time: "2 min ago",
    status: "Awaiting Reply",
  },
  {
    id: 2,
    name: "Maria Garcia",
    initials: "MG",
    preview: "Can I reschedule my appointment to next week?",
    time: "15 min ago",
    status: "Awaiting Reply",
  },
  {
    id: 3,
    name: "Ana Reyes",
    initials: "AR",
    preview: "Is there any update on my car's AC repair?",
    time: "2h ago",
    status: "Vehicle Inquiry",
  },
  {
    id: 4,
    name: "Carlos Rivera",
    initials: "CR",
    preview: "Thank you for the update! I'll pick it up tomorrow.",
    time: "1h ago",
    status: "Replied",
  },
  {
    id: 5,
    name: "Lisa Tan",
    initials: "LT",
    preview: "I'll come by tomorrow to drop off my car.",
    time: "3h ago",
    status: "Replied",
  },
]

const statusStyle: Record<string, string> = {
  "Awaiting Reply": "bg-yellow-100 text-yellow-700",
  "Vehicle Inquiry": "bg-orange-100 text-orange-600",
  "Replied": "bg-green-100 text-green-600",
}

export default function RecentConversations() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Recent Conversations</h2>
        <button className="text-sm text-blue-500 hover:text-blue-700 font-medium transition-colors">
          View All →
        </button>
      </div>

      <div className="space-y-1">
        {conversations.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center shrink-0">
              {c.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">{c.name}</div>
              <div className="text-xs text-gray-400 truncate">{c.preview}</div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-xs text-gray-400">{c.time}</span>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusStyle[c.status]}`}>
                {c.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
