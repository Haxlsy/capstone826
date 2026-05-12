"use client"

import {
  Clock, PlayCircle, ClipboardCheck,
  AlertTriangle, PackageCheck, ShieldCheck,
} from "lucide-react"

export type JobStatus =
  | "Pending"
  | "Ongoing"
  | "For Rework"
  | "For Inspection"
  | "For Release"
  | "Released"
  | "Delayed"

export interface StatusOption {
  label: JobStatus
  db: string
  icon: React.ReactNode
  ring: string
  bg: string
  text: string
  iconBg: string
}

export const STATUS_OPTIONS: StatusOption[] = [
  {
    label: "Pending",
    db: "Pending",
    icon: <Clock className="w-4 h-4" />,
    ring: "ring-amber-200",
    bg: "bg-amber-50 hover:bg-amber-100",
    text: "text-amber-700",
    iconBg: "bg-amber-100",
  },
  {
    label: "Ongoing",
    db: "Ongoing",
    icon: <PlayCircle className="w-4 h-4" />,
    ring: "ring-blue-200",
    bg: "bg-blue-50 hover:bg-blue-100",
    text: "text-blue-700",
    iconBg: "bg-blue-100",
  },
  {
    label: "For Rework",
    db: "For Rework",
    icon: <AlertTriangle className="w-4 h-4" />,
    ring: "ring-orange-200",
    bg: "bg-orange-50 hover:bg-orange-100",
    text: "text-orange-700",
    iconBg: "bg-orange-100",
  },
  {
    label: "For Inspection",
    db: "For Inspection",
    icon: <ShieldCheck className="w-4 h-4" />,
    ring: "ring-violet-200",
    bg: "bg-violet-50 hover:bg-violet-100",
    text: "text-violet-700",
    iconBg: "bg-violet-100",
  },
  {
    label: "For Release",
    db: "For Release",
    icon: <ClipboardCheck className="w-4 h-4" />,
    ring: "ring-emerald-200",
    bg: "bg-emerald-50 hover:bg-emerald-100",
    text: "text-emerald-700",
    iconBg: "bg-emerald-100",
  },
  {
    label: "Released",
    db: "Released",
    icon: <PackageCheck className="w-4 h-4" />,
    ring: "ring-teal-200",
    bg: "bg-teal-50 hover:bg-teal-100",
    text: "text-teal-700",
    iconBg: "bg-teal-100",
  },
  {
    label: "Delayed",
    db: "Delayed",
    icon: <AlertTriangle className="w-4 h-4" />,
    ring: "ring-red-200",
    bg: "bg-red-50 hover:bg-red-100",
    text: "text-red-700",
    iconBg: "bg-red-100",
  },
]

export const ALLOWED_NEXT: Record<JobStatus, JobStatus[]> = {
  "Pending":        ["Ongoing", "Delayed"],
  "Ongoing":        ["For Rework", "For Inspection", "For Release", "Delayed"],
  "For Rework":     ["Ongoing", "For Inspection", "Delayed"],
  "For Inspection": ["For Release", "Delayed"],
  "For Release":    ["Released"],
  "Released":       [],
  "Delayed":        ["Ongoing", "For Inspection", "For Release"],
}

export const STATUS_BADGE_MAP: Record<string, string> = {
  Pending:          "bg-amber-100 text-amber-700",
  Ongoing:          "bg-blue-100 text-blue-700",
  "For Rework":     "bg-orange-100 text-orange-700",
  "For Inspection": "bg-violet-100 text-violet-700",
  "For Release":    "bg-emerald-100 text-emerald-700",
  Released:         "bg-teal-100 text-teal-700",
  Delayed:          "bg-red-100 text-red-700",
}

interface Props {
  jobId: string
  customerName: string
  currentStatus: JobStatus
  onSelect: (opt: StatusOption) => void
  onClose: () => void
}

export default function StatusPickerModal({ jobId, customerName, currentStatus, onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <p className="text-xs text-gray-400 font-mono">{jobId}</p>
          <h2 className="text-base font-bold text-gray-800 mt-0.5">{customerName}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Current status:{" "}
            <span className={`font-semibold ${(STATUS_BADGE_MAP[currentStatus] || "bg-gray-100 text-gray-500").split(" ")[1]}`}>
              {currentStatus}
            </span>
          </p>
        </div>

        {/* Options */}
        <div className="px-4 py-3 flex flex-col gap-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
            Select next status
          </p>
          {STATUS_OPTIONS.map((opt) => {
            const isCurrent  = opt.label === currentStatus
            const isAllowed  = ALLOWED_NEXT[currentStatus]?.includes(opt.label) ?? false
            const isDisabled = isCurrent || !isAllowed
            return (
              <button
                key={opt.db}
                onClick={() => isAllowed && onSelect(opt)}
                disabled={isDisabled}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ring-1 ${opt.ring} ${opt.bg} ${opt.text} ${
                  isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${opt.iconBg}`}>
                  {opt.icon}
                </span>
                <span className="flex-1 text-left">{opt.label}</span>
                {isCurrent && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Current</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full mt-1 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
