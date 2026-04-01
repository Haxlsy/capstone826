"use client"

import { X, Check } from "lucide-react"

export interface StatusEntry {
  status: "Pending" | "Ongoing" | "Quality Check" | "Completed" | "Delayed" | "Cancelled" | "Released"
  time: string
  actor: string
}

export interface StageEntry {
  name: string
  date: string
  done: boolean
}

export interface JobOrderFull {
  id: string
  customer: string
  vehicle: string
  service: string
  technician: string
  status: "Released" | "Completed" | "Delayed" | "Ongoing" | "Pending" | "Quality Check" | "Cancelled"
  created: string
  completed: string | null
  history: StatusEntry[]
  stages: StageEntry[]
  documentation: number
}

interface JobHistoryDrawerProps {
  record: JobOrderFull | null
  onClose: () => void
}

const statusBadgeMap: Record<StatusEntry["status"], string> = {
  Pending: "bg-amber-100 text-amber-700",
  Ongoing: "bg-blue-100 text-blue-700",
  "Quality Check": "bg-orange-100 text-orange-600",
  Completed: "bg-green-100 text-green-600",
  Delayed: "bg-red-100 text-red-500",
  Cancelled: "bg-gray-100 text-gray-500",
  Released: "bg-teal-100 text-teal-600",
}

export default function JobHistoryDrawer({ record, onClose }: JobHistoryDrawerProps) {
  const isOpen = record !== null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[420px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-800">
            Job History — {record?.id}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        {record && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Section 1: Status Timeline */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-3">Status Timeline</p>
              <div className="flex flex-col">
                {record.history.map((entry, idx) => (
                  <div key={idx} className="flex gap-3">
                    {/* Left: circle + line */}
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full border-2 border-gray-300 bg-white shrink-0 mt-0.5" />
                      {idx < record.history.length - 1 && (
                        <div className="w-px bg-gray-200 flex-1 my-1" style={{ minHeight: "24px" }} />
                      )}
                    </div>
                    {/* Right: content */}
                    <div className="pb-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeMap[entry.status]}`}
                      >
                        {entry.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">{entry.time}</p>
                      <p className="text-xs text-gray-400">{entry.actor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Stage Progression */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-3">Stage Progression</p>
              <div className="space-y-2">
                {record.stages.map((stage, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Check
                        className={`w-4 h-4 ${stage.done ? "text-green-500" : "text-gray-300"}`}
                      />
                      <span className="text-sm text-gray-700 ml-2">{stage.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{stage.date}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Documentation */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-3">Documentation</p>
              {record.documentation > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: record.documentation }).map((_, i) => (
                    <div
                      key={i}
                      className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No documentation attached.</p>
              )}
            </div>

          </div>
        )}
      </div>
    </>
  )
}
