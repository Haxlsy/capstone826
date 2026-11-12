"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Clock,
  Wrench,
  RefreshCw,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  MessageCircleWarning,
  ChevronRight,
} from "lucide-react"
import { StatCard } from "@/components/ui/StatCard"
import { Modal } from "@/components/ui/Modal"
import { JobStatusBadges } from "@/components/ui/Badge"
import { Sk } from "@/components/ui/skeleton"
import type { ConcernSummary, JobSummary } from "@/lib/operations/dashboard-data"
import { fmtDateTimeShort } from "@/lib/time-display"

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
  jobsByStatus?: Record<string, JobSummary[]>
  pendingConcerns?: ConcernSummary[]
}

const CONCERNS_KEY = "concerns"

export default function StatusSummaryCards({ loading, counts, concernCount, jobsByStatus, pendingConcerns }: Props) {
  const router = useRouter()
  const [statusModal, setStatusModal] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-card bg-surface-muted p-4">
            <Sk className="h-3.5 w-20" />
            <Sk className="h-7 w-8" />
          </div>
        ))}
      </div>
    )
  }

  const activeConfig = STATUS_CONFIG.find((c) => c.key === statusModal)
  const showingConcerns = statusModal === CONCERNS_KEY
  const modalJobs = statusModal && !showingConcerns ? jobsByStatus?.[statusModal] ?? [] : []
  const concerns = pendingConcerns ?? []
  const modalTitle = showingConcerns
    ? `Pending Concerns (${concerns.length})`
    : activeConfig ? `${activeConfig.label} (${modalJobs.length})` : ""

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {STATUS_CONFIG.map(({ key, label, icon, tone }) => (
        <StatCard
          key={key}
          label={label}
          value={counts[key] ?? 0}
          icon={icon}
          tone={tone}
          onClick={jobsByStatus ? () => setStatusModal(key) : undefined}
        />
      ))}
      <StatCard
        label="Concerns"
        value={concernCount}
        icon={MessageCircleWarning}
        tone="concern"
        // Same as the job cards: a list of the pending concerns. Each one opens
        // its drawer on the Concerns page (?concern=<id>). Older cached data
        // without the list falls back to the pre-filtered Concerns page.
        onClick={() =>
          pendingConcerns ? setStatusModal(CONCERNS_KEY) : router.push("/dashboard/concerns?filter=Pending")
        }
      />

      <Modal
        open={statusModal !== null}
        onClose={() => setStatusModal(null)}
        title={modalTitle}
        size="sm"
      >
        {showingConcerns ? (
          <div className="space-y-2">
            {concerns.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setStatusModal(null); router.push(`/dashboard/concerns?concern=${c.id}`) }}
                className="flex w-full items-center justify-between gap-2 rounded-sm border border-border-subtle px-3 py-2.5 text-left text-sm hover:bg-surface-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-heading truncate">{c.title}</p>
                  <p className="text-xs text-muted truncate">
                    {[c.job_order_code, c.submitter_name, fmtDateTimeShort(c.submitted_at)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </button>
            ))}
            {concerns.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">No pending concerns.</p>
            )}
          </div>
        ) : (
        <div className="space-y-2">
          {modalJobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => { setStatusModal(null); router.push(`/dashboard/job-management/${job.id}`) }}
              className="flex w-full items-center justify-between gap-2 rounded-sm border border-border-subtle px-3 py-2.5 text-left text-sm hover:bg-surface-muted transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-heading truncate">{job.job_order_code}</p>
                <p className="text-xs text-muted truncate">{job.customer_name} · {job.service_name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <JobStatusBadges status={job.status} isOverdue={job.is_overdue} stacked />
                <ChevronRight className="h-4 w-4 text-muted" />
              </div>
            </button>
          ))}
          {modalJobs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">No job orders in this status.</p>
          )}
        </div>
        )}
      </Modal>
    </div>
  )
}
