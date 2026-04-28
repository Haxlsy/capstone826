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
      className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] p-4 cursor-pointer active:scale-[0.985] transition-all duration-150 space-y-3.5"
    >
      {/* Top row: job ID + status badge + chevron */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-400 tracking-wide font-mono">
          {job.job_id}
        </span>
        <div className="flex items-center gap-1.5">
          {job.has_delayed_stage && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600">
              <AlertCircle size={10} />
              Stage Delayed
            </span>
          )}
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[job.status]}`}>
            {job.status}
          </span>
          <ChevronRight size={14} className="text-gray-300" />
        </div>
      </div>

      {/* Vehicle info as main heading, customer as subheading */}
      <div>
        <div className="flex items-center gap-1.5">
          <Car size={13} className="text-gray-500 shrink-0" />
          <p className="font-bold text-gray-900 text-base leading-snug tracking-tight truncate">
            {job.plate_number}
            {job.car_make ? ` · ${job.car_make}` : ""}
          </p>
        </div>
        {job.car_color && (
          <p className="text-xs text-gray-400 mt-0.5 pl-0.5">{job.car_color}</p>
        )}
        <p className="text-xs font-medium text-gray-500 mt-1 pl-0.5">{job.customer_name}</p>
        {job.service && (
          <p className="text-xs font-semibold text-gray-700 mt-1 pl-0.5">{job.service}</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-50" />

      {/* Meta row + progress */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-gray-400">
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
                      <span className="inline-block w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                      <span className="text-[11px] font-medium text-gray-500">{group.label}</span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {group.done}/{group.total} done
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-teal-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="w-full h-1.5 bg-teal-50 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 font-medium">{job.progress}% complete</p>
          </div>
        )}
      </div>
    </div>
  )
}
