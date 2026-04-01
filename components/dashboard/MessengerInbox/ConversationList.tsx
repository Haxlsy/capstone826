import { Search } from "lucide-react"
import type { Conversation, FilterTab } from "./MessengerInbox"

const tabs: FilterTab[] = ["All", "Awaiting Reply", "Vehicle Inquiry", "Replied"]

const statusDot: Record<string, string> = {
  "Awaiting Reply": "bg-yellow-400",
  "Vehicle Inquiry": "bg-orange-400",
  "Replied": "bg-green-400",
}

const statusBadge: Record<string, string> = {
  "Awaiting Reply": "bg-yellow-100 text-yellow-700",
  "Vehicle Inquiry": "bg-orange-100 text-orange-600",
  "Replied": "bg-green-100 text-green-600",
}

interface Props {
  conversations: Conversation[]
  activeId: number
  filter: FilterTab
  search: string
  onSelect: (id: number) => void
  onFilterChange: (tab: FilterTab) => void
  onSearchChange: (val: string) => void
}

export default function ConversationList({
  conversations,
  activeId,
  filter,
  search,
  onSelect,
  onFilterChange,
  onSearchChange,
}: Props) {
  return (
    <div className="w-[260px] shrink-0 border-r border-gray-100 bg-white flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 placeholder-gray-400 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-3 pb-2 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onFilterChange(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === tab
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3 py-3 border-b border-gray-50 transition-colors ${
              activeId === c.id ? "bg-blue-50" : "hover:bg-gray-50"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center">
                  {c.initials}
                </div>
                {c.unread && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-semibold text-gray-800 truncate">{c.name}</span>
                  <span className="text-[11px] text-gray-400 shrink-0 ml-1">{c.time}</span>
                </div>
                <p className="text-xs text-gray-400 truncate mb-1.5">{c.preview}</p>
                <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadge[c.status]}`}>
                  {c.status}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
