"use client"

import { useState, useEffect, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

type DotColor = "blue" | "green" | "orange" | "red" | "teal" | "gray"

const STATUS_DOT_COLOR: Record<string, DotColor> = {
  pending:       "blue",
  ongoing:       "blue",
  quality_check: "orange",
  completed:     "green",
  delayed:       "red",
  released:      "teal",
  cancelled:     "gray",
}

const dotColorMap: Record<DotColor, string> = {
  blue:   "bg-blue-500",
  green:  "bg-green-500",
  orange: "bg-orange-400",
  red:    "bg-red-500",
  teal:   "bg-teal-500",
  gray:   "bg-gray-400",
}

const legendItems: { color: DotColor; label: string }[] = [
  { color: "blue",   label: "Scheduled / Ongoing" },
  { color: "green",  label: "Completed" },
  { color: "orange", label: "Quality Check" },
  { color: "red",    label: "Delayed" },
]

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

interface CalendarJob {
  scheduled_start: string
  scheduled_end: string | null
  status: string
  team_id: string | null
  team_name: string
  team_lead: string | null
  duration_hours: number | null
  job_order_id: number
}

interface DayJobs {
  date: number
  jobs: CalendarJob[]
}

export default function JobCalendarView() {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed

  const [calendarJobs, setCalendarJobs] = useState<CalendarJob[]>([])
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/operations/dashboard")
      .then((r) => r.json())
      .then((json) => { if (json.calendar_jobs) setCalendarJobs(json.calendar_jobs) })
      .catch(() => {})
  }, [])

  // Navigate months
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
      const d = new Date(job.scheduled_start)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        const color = STATUS_DOT_COLOR[job.status] ?? "gray"
        if (!map[day]) map[day] = { colors: [], jobs: [] }
        map[day].colors.push(color)
        map[day].jobs.push(job)
      }
    }
    return map
  }, [calendarJobs, year, month])

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay() // 0 = Sun
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
        <h2 className="text-sm font-semibold text-gray-800">Technician Team Schedule</h2>
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
          const isToday = isCurrentMonth && day === today.getDate()
          const dayData = jobsByDate[day] ?? { colors: [], jobs: [] }
          const hasJobs = dayData.jobs.length > 0
          const showDetails = hoveredDay === day && hasJobs

          return (
            <div
              key={day}
              className="relative"
              onMouseEnter={() => hasJobs && setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <div
                className={`h-20 rounded-lg flex flex-col items-center pt-1.5 gap-1 cursor-pointer transition-colors ${
                  isToday ? "bg-gray-900" : "hover:bg-gray-50"
                } ${hasJobs ? "border-2 border-blue-200" : ""}`}
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
                  <span className="text-xs font-semibold text-blue-600">{dayData.jobs.length} job{dayData.jobs.length !== 1 ? "s" : ""}</span>
                )}
              </div>

              {/* Tooltip with team and duration details */}
              {showDetails && (
                <div className="absolute z-20 top-full mt-1 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-48 max-h-64 overflow-y-auto">
                  <div className="text-xs font-semibold text-gray-800 mb-2">Scheduled Teams & Durations</div>
                  {dayData.jobs.map((job) => (
                    <div key={job.job_order_id} className="mb-2 pb-2 border-b border-gray-100 last:border-b-0 last:pb-0">
                      <div className="text-xs font-medium text-gray-700">{job.team_name}</div>
                      {job.duration_hours && (
                        <div className="text-xs text-gray-600">Duration: {job.duration_hours} hours</div>
                      )}
                      {job.team_lead && (
                        <div className="text-xs text-gray-500">Lead: {job.team_lead}</div>
                      )}
                      <div className={`text-xs py-0.5 px-1.5 rounded mt-1 inline-block ${
                        job.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                        job.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
                        job.status === 'completed' ? 'bg-green-100 text-green-700' :
                        job.status === 'quality_check' ? 'bg-orange-100 text-orange-700' :
                        job.status === 'delayed' ? 'bg-red-100 text-red-700' :
                        job.status === 'released' ? 'bg-teal-100 text-teal-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {job.status.replace('_', ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 border-t border-gray-50">
        {legendItems.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dotColorMap[color]}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
