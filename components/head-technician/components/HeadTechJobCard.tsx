"use client"

import { useRouter } from "next/navigation"
import { Car, Calendar, User, ChevronRight, Clock } from "lucide-react"
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

  const progressColor =
    job.progress >= 80 ? "bg-emerald-500" :
    job.progress >= 40 ? "bg-blue-500" :
    "bg-gray-300"

  const progressBg =
    job.progress >= 80 ? "bg-emerald-50" :
    job.progress >= 40 ? "bg-blue-50" :
    "bg-gray-100"

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
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[job.status]}`}>
            {job.status}
          </span>
          <ChevronRight size={14} className="text-gray-300" />
        </div>
      </div>

      {/* Customer name */}
      <div>
        <p className="font-bold text-gray-900 text-base leading-snug tracking-tight">
          {job.customer_name}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <Car size={11} className="text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500 truncate">
            {job.plate_number}
            {job.car_make  ? ` · ${job.car_make}` : ""}
            {job.car_color ? ` · ${job.car_color}` : ""}
          </span>
        </div>
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

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className={`w-full h-2 ${progressBg} rounded-full overflow-hidden`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 font-medium">{job.progress}% complete</p>
        </div>
      </div>
    </div>
  )
}
