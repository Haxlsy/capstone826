"use client"

import type { ComponentType } from "react"
import {
  Clock, PlayCircle, RefreshCw, ShieldCheck, ClipboardCheck, PackageCheck, AlertTriangle,
} from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { StatusBadge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { statusStyle } from "@/lib/ui/status"

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
  icon: ComponentType<{ className?: string }>
}

export const STATUS_OPTIONS: StatusOption[] = [
  { label: "Pending", db: "Pending", icon: Clock },
  { label: "Ongoing", db: "Ongoing", icon: PlayCircle },
  { label: "For Rework", db: "For Rework", icon: RefreshCw },
  { label: "For Inspection", db: "For Inspection", icon: ShieldCheck },
  { label: "For Release", db: "For Release", icon: ClipboardCheck },
  { label: "Released", db: "Released", icon: PackageCheck },
  { label: "Delayed", db: "Delayed", icon: AlertTriangle },
]

export const ALLOWED_NEXT: Record<JobStatus, JobStatus[]> = {
  Pending: ["Ongoing"],
  Ongoing: ["For Rework", "For Inspection", "For Release"],
  "For Rework": ["Ongoing", "For Inspection"],
  "For Inspection": ["For Release"],
  "For Release": ["Released"],
  Released: [],
  Delayed: ["Ongoing", "For Inspection", "For Release"],
}

interface Props {
  jobId: string
  customerName: string
  currentStatus: JobStatus
  onSelect: (opt: StatusOption) => void
  onClose: () => void
}

export default function StatusPickerModal({
  jobId,
  customerName,
  currentStatus,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal open onClose={onClose} size="sm" title={customerName} description={`Job ${jobId}`}>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-body">
        Current status: <StatusBadge status={currentStatus} />
      </p>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Select next status</p>
      <div className="flex flex-col gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const isCurrent = opt.label === currentStatus
          const isAllowed = ALLOWED_NEXT[currentStatus]?.includes(opt.label) ?? false
          const disabled = isCurrent || !isAllowed
          const s = statusStyle(opt.label)
          const Icon = opt.icon
          return (
            <button
              key={opt.db}
              onClick={() => isAllowed && onSelect(opt)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
                s.soft,
                disabled ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:brightness-95",
              )}
            >
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-sm", s.iconChip)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-left">{opt.label}</span>
              {isCurrent && (
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
                  Current
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-3">
        <Button variant="ghost" fullWidth onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  )
}
