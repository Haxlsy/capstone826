"use client"

import { ListChecks, AlertCircle } from "lucide-react"

interface Props {
  count: number
  allSameStatus: boolean
  onClick: () => void
}

export default function BulkStatusButton({ count, allSameStatus, onClick }: Props) {
  if (count === 0) return null

  return (
    <div className="flex items-center gap-2">
      {!allSameStatus && (
        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Select jobs with the same status to bulk update
        </span>
      )}
      <button
        onClick={onClick}
        disabled={!allSameStatus}
        title={
          allSameStatus
            ? `Update status for ${count} selected job${count > 1 ? "s" : ""}`
            : "All selected jobs must share the same status"
        }
        className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 h-9 rounded-lg border transition-colors ${
          allSameStatus
            ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
            : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
        }`}
      >
        <ListChecks className="w-4 h-4" />
        Update Status
        <span
          className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
            allSameStatus ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
          }`}
        >
          {count}
        </span>
      </button>
    </div>
  )
}
