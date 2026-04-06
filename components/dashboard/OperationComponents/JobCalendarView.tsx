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
  status: string
}

export default function JobCalendarView() {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed

  const [calendarJobs, setCalendarJobs] = useState<CalendarJob[]>([])

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

  // Build dot data for this month
  const dotData = useMemo<Record<number, DotColor[]>>(() => {
    const map: Record<number, DotColor[]> = {}
    for (const job of calendarJobs) {
      const d = new Date(job.scheduled_start)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        const color = STATUS_DOT_COLOR[job.status] ?? "gray"
        if (!map[day]) map[day] = []
        map[day].push(color)
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
        <h2 className="text-sm font-semibold text-gray-800">Job Calendar View</h2>
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
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="h-14" />
          const isToday = isCurrentMonth && day === today.getDate()
          const dots    = dotData[day] ?? []
          return (
            <div
              key={day}
              className={`h-14 rounded-lg flex flex-col items-center pt-1.5 gap-1 cursor-pointer transition-colors ${
                isToday ? "bg-gray-900" : "hover:bg-gray-50"
              }`}
            >
              <span className={`text-xs font-medium leading-none ${isToday ? "text-white" : "text-gray-700"}`}>
                {day}
              </span>
              <div className="flex gap-0.5 flex-wrap justify-center px-1">
                {dots.slice(0, 3).map((color, i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${dotColorMap[color]}`} />
                ))}
              </div>
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
