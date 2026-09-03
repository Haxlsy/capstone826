"use client"

import {
  Clock,
  Wrench,
  RefreshCw,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  MessageCircleWarning,
} from "lucide-react"
import { StatCard } from "@/components/ui/StatCard"
import { Sk } from "@/components/ui/skeleton"

const STATUS_CONFIG = [
  { key: "pending",        label: "Pending",        icon: Clock,        tone: "pending" as const },
  { key: "ongoing",        label: "Ongoing",        icon: Wrench,       tone: "ongoing" as const },
  { key: "for_rework",     label: "For Rework",     icon: RefreshCw,    tone: "rework" as const },
  { key: "for_inspection", label: "For Inspection", icon: PackageCheck, tone: "inspection" as const },
  { key: "for_release",    label: "For Release",    icon: CheckCircle2, tone: "release" as const },
  { key: "delayed",        label: "Delayed",        icon: AlertTriangle, tone: "delayed" as const },
]

interface Props {
  loading: boolean
  counts: Record<string, number>
  concernCount: number
}

export default function StatusSummaryCards({ loading, counts, concernCount }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface p-4">
            <Sk className="h-8 w-8 rounded-sm" />
            <div className="space-y-2">
              <Sk className="h-6 w-10" />
              <Sk className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {STATUS_CONFIG.map(({ key, label, icon, tone }) => (
        <StatCard key={key} label={label} value={counts[key] ?? 0} icon={icon} tone={tone} />
      ))}
      <StatCard
        label="Concerns"
        value={concernCount}
        icon={MessageCircleWarning}
        tone="concern"
      />
    </div>
  )
}
