"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, Clock, CalendarClock, CheckCircle2, User } from "lucide-react"
import { Card, CardBody } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { StatusBadge } from "@/components/ui/Badge"
import { Sk } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { statusStyle } from "@/lib/ui/status"
import { fmtDateTimeShort } from "@/lib/time-display"
import { displayJobStatus } from "@/lib/job-delay"

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const legendItems = [
  { status: "Pending", label: "Pending" },
  { status: "Ongoing", label: "Ongoing" },
  { status: "For Release", label: "For Release / Released" },
  { status: "For Rework", label: "For Rework" },
  { status: "Delayed", label: "Delayed" },
]

interface CalendarJob {
  id: string
  scheduled_at: string
  actual_start_at: string | null
  expected_completion_at: string | null
  status: string
  is_overdue: boolean
  customer: string
  service: string
  head_detailer: string | null
  head_installer: string | null
}

function CompactTooltip({ jobs, align = "left" }: { jobs: CalendarJob[]; align?: "left" | "right" }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-full z-30 mt-1 w-52 rounded-card border border-border-subtle bg-surface py-2 shadow-pop",
        align === "right" ? "right-0" : "left-0",
      )}
    >
      <p className="mb-1 border-b border-border-subtle px-3 pb-1.5 text-xs font-semibold text-body">
        {jobs.length} job{jobs.length !== 1 ? "s" : ""}
      </p>
      <div className="max-h-44 overflow-y-auto">
        {jobs.map((job) => {
          const status = displayJobStatus(job.status, job.is_overdue)
          return (
            <div key={job.id} className="flex items-center gap-2 px-3 py-1">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusStyle(status).dot)} />
              <span className="flex-1 truncate text-xs text-heading">{job.customer}</span>
              <StatusBadge status={status} className="shrink-0 text-[10px]" />
            </div>
          )
        })}
      </div>
      <p className="mt-1 border-t border-border-subtle px-3 pt-1.5 text-center text-[10px] text-muted">
        Click for full details
      </p>
    </div>
  )
}

interface Props {
  loading: boolean
  calendarJobs: CalendarJob[]
}

export default function JobCalendarView({ loading, calendarJobs }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }
  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const jobsByDate = useMemo<Record<number, CalendarJob[]>>(() => {
    const map: Record<number, CalendarJob[]> = {}
    for (const job of calendarJobs) {
      const d = new Date(job.scheduled_at)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        ;(map[day] ??= []).push(job)
      }
    }
    return map
  }, [calendarJobs, year, month])

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const selectedJobs = selectedDay !== null ? jobsByDate[selectedDay] ?? [] : []
  const selectedLabel =
    selectedDay !== null
      ? new Date(year, month, selectedDay).toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
        })
      : ""

  if (loading) {
    return (
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Sk className="h-5 w-24" />
            <Sk className="h-7 w-40 rounded-sm" />
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <Sk key={i} className="h-20 rounded-sm" />
            ))}
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      {/* Teal header bar */}
      <div className="flex items-center justify-between bg-primary px-5 py-3 text-white">
        <h2 className="text-sm font-semibold">Calendar</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-white/80 hover:bg-white/15"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-28 text-center text-sm font-medium">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-white/80 hover:bg-white/15"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="ml-1 rounded-pill bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25"
          >
            Today
          </button>
        </div>
      </div>

      <CardBody className="flex flex-col gap-4">
        <div className="grid grid-cols-7 gap-1">
          {DAY_HEADERS.map((day) => (
            <div key={day} className="py-1 text-center text-xs font-medium text-body">
              {day}
            </div>
          ))}
        </div>

        <div className="relative grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="h-20" />
            const isToday = isCurrentMonth && day === today.getDate()
            const dayJobs = jobsByDate[day] ?? []
            const hasJobs = dayJobs.length > 0
            const showTip = hoveredDay === day && hasJobs

            return (
              <div
                key={day}
                className="relative"
                onMouseEnter={() => hasJobs && setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={() => hasJobs && setSelectedDay(day)}
              >
                <div
                  className={cn(
                    "flex h-20 flex-col items-center gap-1 rounded-sm pt-1.5 transition-colors",
                    isToday ? "bg-primary text-white" : "hover:bg-surface-subtle",
                    hasJobs && "cursor-pointer border-2 border-primary/30",
                  )}
                >
                  <span className={cn("text-xs font-medium leading-none", isToday ? "text-white" : "text-heading")}>
                    {day}
                  </span>
                  <div className="flex flex-wrap justify-center gap-0.5 px-1">
                    {dayJobs.slice(0, 3).map((job, i) => (
                      <span key={i} className={cn("h-1.5 w-1.5 rounded-full", statusStyle(displayJobStatus(job.status, job.is_overdue)).dot)} />
                    ))}
                    {dayJobs.length > 3 && (
                      <span className="text-xs text-muted">+{dayJobs.length - 3}</span>
                    )}
                  </div>
                  {hasJobs && (
                    <span className={cn("text-xs font-semibold", isToday ? "text-white" : "text-primary")}>
                      {dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {showTip && <CompactTooltip jobs={dayJobs} align={idx % 7 >= 5 ? "right" : "left"} />}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-subtle pt-2">
          {legendItems.map(({ status, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", statusStyle(status).dot)} />
              <span className="text-xs text-body">{label}</span>
            </div>
          ))}
        </div>
      </CardBody>

      <Modal
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedLabel}
        description={`${selectedJobs.length} job${selectedJobs.length !== 1 ? "s" : ""} scheduled`}
        size="md"
      >
        <div className="divide-y divide-border-subtle">
          {selectedJobs.map((job) => (
            <div key={job.id} className="py-4 first:pt-0 last:pb-0">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-heading">{job.customer}</p>
                  <p className="mt-0.5 text-xs text-body">{job.service}</p>
                </div>
                <StatusBadge status={displayJobStatus(job.status, job.is_overdue)} className="shrink-0" />
              </div>

              <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {(["Head Detailer", "Head Installer"] as const).map((role, i) => {
                  const val = i === 0 ? job.head_detailer : job.head_installer
                  return (
                    <div key={role}>
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {role}
                      </p>
                      <div className="flex items-center gap-1 text-heading">
                        <User className="h-2.5 w-2.5 shrink-0 text-muted" />
                        <span className={val ? "" : "italic text-muted"}>{val ?? "Unassigned"}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-1.5 border-t border-border-subtle pt-3 text-xs">
                <TimelineRow icon={CalendarClock} label="Scheduled" value={fmtDateTimeShort(job.scheduled_at)} />
                <TimelineRow
                  icon={Clock}
                  label="Started"
                  value={job.actual_start_at ? fmtDateTimeShort(job.actual_start_at) : "Not started yet"}
                  muted={!job.actual_start_at}
                />
                <TimelineRow
                  icon={CheckCircle2}
                  label="Est. End"
                  value={job.expected_completion_at ? fmtDateTimeShort(job.expected_completion_at) : "—"}
                  muted={!job.expected_completion_at}
                />
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </Card>
  )
}

function TimelineRow({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-muted">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className={muted ? "italic text-muted" : "font-medium text-heading"}>{value}</span>
    </div>
  )
}
