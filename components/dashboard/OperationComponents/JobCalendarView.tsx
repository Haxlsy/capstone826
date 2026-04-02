"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

type DotColor = "blue" | "green" | "orange" | "red"

const dotData: Record<number, DotColor[]> = {
  1: ["blue", "blue"],
  2: ["blue"],
  3: ["orange", "orange", "orange"],
  5: ["blue"],
  7: ["blue", "blue"],
  8: ["green"],
  10: ["blue", "blue"],
  12: ["red"],
  14: ["blue", "blue", "blue"],
  15: ["green"],
  18: ["blue", "blue"],
  20: ["green"],
  22: ["blue", "blue"],
  24: ["orange"],
  25: ["blue", "blue", "blue"],
  28: ["blue"],
  30: ["blue", "blue"],
}

const dotColorMap: Record<DotColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-400",
  red: "bg-red-500",
}

const legendItems: { color: DotColor; label: string }[] = [
  { color: "blue", label: "Scheduled" },
  { color: "green", label: "Completed" },
  { color: "orange", label: "Quality Check" },
  { color: "red", label: "Delayed" },
]

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// April 2026: starts on Wednesday (index 3), 30 days
const APRIL_START_DAY = 3
const APRIL_DAYS = 30
const TODAY_DATE = 1 // April 1, 2026

export default function JobCalendarView() {
  const [_month] = useState("April 2026")

  // Build calendar grid cells
  const cells: (number | null)[] = []
  for (let i = 0; i < APRIL_START_DAY; i++) cells.push(null)
  for (let d = 1; d <= APRIL_DAYS; d++) cells.push(d)
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Job Calendar View</h2>
        <div className="flex items-center gap-2">
          <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-24 text-center">April 2026</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="text-xs font-medium text-blue-600 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors ml-1">
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
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-14" />
          }
          const isToday = day === TODAY_DATE
          const dots = dotData[day] ?? []
          return (
            <div
              key={day}
              className={`h-14 rounded-lg flex flex-col items-center pt-1.5 gap-1 cursor-pointer transition-colors ${
                isToday
                  ? "bg-gray-900"
                  : "hover:bg-gray-50"
              }`}
            >
              <span
                className={`text-xs font-medium leading-none ${
                  isToday ? "text-white" : "text-gray-700"
                }`}
              >
                {day}
              </span>
              <div className="flex gap-0.5 flex-wrap justify-center px-1">
                {dots.slice(0, 3).map((color, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${dotColorMap[color]}`}
                  />
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
