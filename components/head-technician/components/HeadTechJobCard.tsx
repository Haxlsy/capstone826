"use client"

import { useRouter } from "next/navigation"
import { Car, Calendar, User, ChevronRight } from "lucide-react"
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
    "bg-gray-400"

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer active:scale-[0.98] transition-transform space-y-3"
    >
      {/* Top row: job ID + status + chevron */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 tracking-wide">{job.job_id}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[job.status]}`}>
            {job.status}
          </span>
          <ChevronRight size={14} className="text-gray-300" />
        </div>
      </div>

      {/* Customer name */}
      <p className="font-bold text-gray-900 text-base leading-tight">{job.customer_name}</p>

      {/* Vehicle + service */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Car size={12} className="text-gray-400 shrink-0" />
          <span className="truncate">
            {job.plate_number}
            {job.car_make ? ` — ${job.car_make}` : ""}
            {job.car_color ? ` (${job.car_color})` : ""}
          </span>
        </div>
        <p className="text-sm font-medium text-gray-700 pl-4.5">{job.service}</p>
      </div>

      {/* Technician + date */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <User size={11} className="shrink-0" />
          <span>{job.technician_name}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar size={11} className="shrink-0" />
          <span>{job.scheduled_start}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressColor}`}
            style={{ width: `${job.progress}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-400 font-medium">{job.progress}% complete</p>
      </div>
    </div>
  )
}
