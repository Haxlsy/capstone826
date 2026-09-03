"use client"

import { useRouter } from "next/navigation"
import { Car, User, ChevronRight, Clock, AlertCircle } from "lucide-react"
import { HeadTechJob, STATUS_STYLES } from "./types"

type HeadTechJobCardProps = {
  job: HeadTechJob
}

export function HeadTechJobCard({ job }: HeadTechJobCardProps) {
  const router = useRouter()

  function handleClick() {
    const id = job.raw_id ?? job.job_id
    router.push(`/head-technician/${id}`)
  }

  const hasGroups = job.stage_groups && job.stage_groups.length > 0

  return (
    <div
      onClick={handleClick}
      className="bg-surface rounded-card border border-border-subtle shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] p-4 cursor-pointer active:scale-[0.985] transition-all duration-150 space-y-3.5"
    >
      {/* Top row: job ID + status badge + chevron */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted tracking-wide font-mono">
          {job.job_id}
        </span>
        <div className="flex items-center gap-1.5">
          {job.has_delayed_stage && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-status-delayed/12 text-status-delayed">
              <AlertCircle size={10} />
              Stage Delayed
            </span>
          )}
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[job.status]}`}>
            {job.status}
          </span>
          <ChevronRight size={14} className="text-muted" />
        </div>
      </div>

      {/* Vehicle info as main heading, customer as subheading */}
      <div>
        <div className="flex items-center gap-1.5">
          <Car size={13} className="text-body shrink-0" />
          <p className="font-bold text-heading text-base leading-snug tracking-tight truncate">
            {job.plate_number}
            {job.car_make ? ` · ${job.car_make}` : ""}
          </p>
        </div>
        {job.car_color && (
          <p className="text-xs text-muted mt-0.5 pl-0.5">{job.car_color}</p>
        )}
        <p className="text-xs font-medium text-body mt-1 pl-0.5">{job.customer_name}</p>
        {job.service && (
          <p className="text-xs font-semibold text-body mt-1 pl-0.5">{job.service}</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border-subtle" />

      {/* Meta row + progress */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-muted">
          <div className="flex items-center gap-1">
            <User size={11} className="shrink-0" />
            <span className="font-medium">{job.technician_name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={11} className="shrink-0" />
            <span>{job.scheduled_start}</span>
          </div>
        </div>

        {/* Per-category progress bars */}
        {hasGroups ? (
          <div className="space-y-2">
            {job.stage_groups.map((group) => {
              const pct = group.total > 0 ? Math.round((group.done / group.total) * 100) : 0
              return (
                <div key={group.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-status-release shrink-0" />
                      <span className="text-[11px] font-medium text-body">{group.label}</span>
                    </div>
                    <span className="text-[11px] text-muted">
                      {group.done}/{group.total} done
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-status-release/15 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-status-release rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="w-full h-1.5 bg-status-release/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-status-release rounded-full transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted font-medium">{job.progress}% complete</p>
          </div>
        )}
      </div>
    </div>
  )
}
