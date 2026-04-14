"use client"

import { useState, useEffect, useMemo } from "react"
import { ChevronLeft, ChevronRight, Clock, CalendarClock, CheckCircle2, User, X } from "lucide-react"

type DotColor = "blue" | "green" | "orange" | "red" | "teal" | "amber" | "gray"

const STATUS_DOT_COLOR: Record<string, DotColor> = {
  Pending:      "amber",
  Ongoing:      "blue",
  "For Rework": "orange",
  "For Release":"green",
  Released:     "teal",
  Delayed:      "red",
  Cancelled:    "gray",
}

const dotColorMap: Record<DotColor, string> = {
  blue:   "bg-blue-500",
  green:  "bg-green-500",
  orange: "bg-orange-400",
  red:    "bg-red-500",
  teal:   "bg-teal-500",
  amber:  "bg-amber-400",
  gray:   "bg-gray-400",
}

const badgeMap: Record<string, string> = {
  Pending:       "bg-amber-100 text-amber-700",
  Ongoing:       "bg-blue-100 text-blue-700",
  "For Rework":  "bg-orange-100 text-orange-700",
  "For Release": "bg-green-100 text-green-700",
  Released:      "bg-teal-100 text-teal-700",
  Delayed:       "bg-red-100 text-red-700",
  Cancelled:     "bg-gray-100 text-gray-600",
}

const legendItems: { color: DotColor; label: string }[] = [
  { color: "amber",  label: "Pending" },
  { color: "blue",   label: "Ongoing" },
  { color: "green",  label: "For Release / Released" },
  { color: "orange", label: "For Rework" },
  { color: "red",    label: "Delayed" },
]

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

interface CalendarJob {
  id:                     string
  scheduled_at:           string
  actual_start_at:        string | null
  expected_completion_at: string | null
  status:                 string
  customer:               string
  service:                string
  head_detailer:          string | null
  head_installer:         string | null
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  })
}

// ── Compact hover tooltip — one line per job, handles 15+ cleanly ────────────
function CompactTooltip({ jobs }: { jobs: CalendarJob[] }) {
  return (
    <div className="absolute z-30 top-full mt-1 left-0 bg-white rounded-xl shadow-xl border border-gray-200 py-2 w-52 pointer-events-none">
      <p className="text-xs font-semibold text-gray-500 px-3 pb-1.5 border-b border-gray-100 mb-1">
        {jobs.length} job{jobs.length !== 1 ? "s" : ""}
      </p>
      <div className="max-h-44 overflow-y-auto">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center gap-2 px-3 py-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColorMap[STATUS_DOT_COLOR[job.status] ?? "gray"]}`} />
            <span className="text-xs text-gray-700 truncate flex-1">{job.customer}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badgeMap[job.status] ?? "bg-gray-100 text-gray-600"}`}>
              {job.status}
            </span>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] text-gray-400 mt-1 pt-1.5 border-t border-gray-100 px-3">
        Click for full details
      </p>
    </div>
  )
}

// ── Day detail modal — opens on click, shows full team + timeline ─────────────
function DayDetailModal({
  day, month, year, jobs, onClose,
}: {
  day:     number
  month:   number
  year:    number
  jobs:    CalendarJob[]
  onClose: () => void
}) {
  const label = new Date(year, month, day).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-sm font-semibold text-gray-800">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""} scheduled
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Job list — scrollable */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {jobs.map((job) => (
            <div key={job.id} className="px-5 py-4">
              {/* Customer + service + status */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{job.customer}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{job.service}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${badgeMap[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {job.status}
                </span>
              </div>

              {/* Head Detailer + Head Installer */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-xs">
                <div>
                  <p className="text-gray-400 uppercase tracking-wide mb-0.5 font-semibold" style={{ fontSize: "9px" }}>
                    Head Detailer
                  </p>
                  <div className="flex items-center gap-1 text-gray-700">
                    <User className="w-2.5 h-2.5 shrink-0 text-gray-400" />
                    <span className={job.head_detailer ? "" : "italic text-gray-400"}>
                      {job.head_detailer ?? "Unassigned"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wide mb-0.5 font-semibold" style={{ fontSize: "9px" }}>
                    Head Installer
                  </p>
                  <div className="flex items-center gap-1 text-gray-700">
                    <User className="w-2.5 h-2.5 shrink-0 text-gray-400" />
                    <span className={job.head_installer ? "" : "italic text-gray-400"}>
                      {job.head_installer ?? "Unassigned"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline — stacked rows */}
              <div className="space-y-1.5 text-xs border-t border-gray-50 pt-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <CalendarClock className="w-3 h-3" />
                    Scheduled
                  </span>
                  <span className="text-gray-700 font-medium">{fmtDateTime(job.scheduled_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <Clock className="w-3 h-3" />
                    Started
                  </span>
                  <span className={job.actual_start_at ? "text-blue-600 font-medium" : "italic text-gray-400"}>
                    {job.actual_start_at ? fmtDateTime(job.actual_start_at) : "Not started yet"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-400">
                    <CheckCircle2 className="w-3 h-3" />
                    Est. End
                  </span>
                  <span className={job.expected_completion_at ? "text-gray-700" : "italic text-gray-400"}>
                    {job.expected_completion_at ? fmtDateTime(job.expected_completion_at) : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function JobCalendarView() {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed

  const [calendarJobs, setCalendarJobs] = useState<CalendarJob[]>([])
  const [hoveredDay, setHoveredDay]     = useState<number | null>(null)
  const [selectedDay, setSelectedDay]   = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/operations/dashboard")
      .then((r) => r.json())
      .then((json) => { if (json.calendar_jobs) setCalendarJobs(json.calendar_jobs) })
      .catch(() => {})
  }, [])

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

  // Build dot and job data for this month
  const jobsByDate = useMemo<Record<number, { colors: DotColor[]; jobs: CalendarJob[] }>>(() => {
    const map: Record<number, { colors: DotColor[]; jobs: CalendarJob[] }> = {}
    for (const job of calendarJobs) {
      const d = new Date(job.scheduled_at)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day   = d.getDate()
        const color = STATUS_DOT_COLOR[job.status] ?? "gray"
        if (!map[day]) map[day] = { colors: [], jobs: [] }
        map[day].colors.push(color)
        map[day].jobs.push(job)
      }
    }
    return map
  }, [calendarJobs, year, month])

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth     = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Calendar</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-28 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            className="text-xs font-medium text-blue-600 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors ml-1"
          >
            Today
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 relative">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="h-20" />
          const isToday  = isCurrentMonth && day === today.getDate()
          const dayData  = jobsByDate[day] ?? { colors: [], jobs: [] }
          const hasJobs  = dayData.jobs.length > 0
          const showTip  = hoveredDay === day && hasJobs

          return (
            <div
              key={day}
              className="relative"
              onMouseEnter={() => hasJobs && setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              onClick={() => hasJobs && setSelectedDay(day)}
            >
              <div
                className={`h-20 rounded-lg flex flex-col items-center pt-1.5 gap-1 transition-colors ${
                  isToday ? "bg-gray-900" : "hover:bg-gray-50"
                } ${hasJobs ? "border-2 border-blue-200 cursor-pointer" : ""}`}
              >
                <span className={`text-xs font-medium leading-none ${isToday ? "text-white" : "text-gray-700"}`}>
                  {day}
                </span>
                <div className="flex gap-0.5 flex-wrap justify-center px-1">
                  {dayData.colors.slice(0, 3).map((color, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${dotColorMap[color]}`} />
                  ))}
                  {dayData.colors.length > 3 && (
                    <span className="text-xs text-gray-400">+{dayData.colors.length - 3}</span>
                  )}
                </div>
                {hasJobs && (
                  <span className="text-xs font-semibold text-blue-600">
                    {dayData.jobs.length} job{dayData.jobs.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Compact hover tooltip — just names + status, no crowding */}
              {showTip && <CompactTooltip jobs={dayData.jobs} />}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-gray-50">
        {legendItems.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dotColorMap[color]}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Day detail modal — full job info, opens on cell click */}
      {selectedDay !== null && (
        <DayDetailModal
          day={selectedDay}
          month={month}
          year={year}
          jobs={jobsByDate[selectedDay]?.jobs ?? []}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
