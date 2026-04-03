import { Search, Filter } from "lucide-react"
import type { TabFilter } from "../types"

const tabs: TabFilter[] = ["All", "Pending Job Order", "Job Created", "Cancelled"]

interface Props {
  tab: TabFilter
  search: string
  onTabChange: (tab: TabFilter) => void
  onSearchChange: (search: string) => void
}

export default function IntakeFilters({ tab, search, onTabChange, onSearchChange }: Props) {
  return (
    <>
      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>
        <button className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-0">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              tab === t
                ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </>
  )
}
