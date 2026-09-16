"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ChevronDown, Clock, CalendarClock, CheckCircle2, User } from "lucide-react"
import { Card, CardBody } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { StatusBadge } from "@/components/ui/Badge"
import { Popover, MenuItem } from "@/components/ui/Popover"
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
  { status: "For Inspection", label: "For Inspection" },
  { status: "For Rework", label: "For Rework" },
  { status: "Delayed", label: "Delayed" },
]

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
]

type ViewMode = "today" | "week" | "month"

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

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Stable per-day key — works across month/year boundaries, unlike a bare day-of-month number. */
function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b)
}

function startOfWeek(d: Date) {
  const start = new Date(d)
  start.setDate(start.getDate() - start.getDay())
  start.setHours(0, 0, 0, 0)
  return start
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

function JobDetailBlock({ job }: { job: CalendarJob }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
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
  )
}

interface Props {
  loading: boolean
  calendarJobs: CalendarJob[]
}

export default function JobCalendarView({ loading, calendarJobs }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const today = new Date()

  function handleViewChange(key: string) {
    const mode = key as ViewMode
    setViewMode(mode)
    if (mode === "today") setAnchorDate(new Date())
  }

  function goPrev() {
    setAnchorDate((d) => {
      const next = new Date(d)
      if (viewMode === "week") next.setDate(next.getDate() - 7)
      else next.setMonth(next.getMonth() - 1)
      return next
    })
  }
  function goNext() {
    setAnchorDate((d) => {
      const next = new Date(d)
      if (viewMode === "week") next.setDate(next.getDate() + 7)
      else next.setMonth(next.getMonth() + 1)
      return next
    })
  }
  // Indexed once, by date — reused across every view mode instead of each
  // computing its own month/week/year-scoped filter.
  const jobsByDate = useMemo<Record<string, CalendarJob[]>>(() => {
    const map: Record<string, CalendarJob[]> = {}
    for (const job of calendarJobs) {
      const key = dateKey(new Date(job.scheduled_at))
      ;(map[key] ??= []).push(job)
    }
    return map
  }, [calendarJobs])

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate])
  const weekCells = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    }),
    [weekStart],
  )

  const monthCells = useMemo(() => {
    const year = anchorDate.getFullYear()
    const month = anchorDate.getMonth()
    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDayOfMonth; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [anchorDate])

  const todaysJobs = jobsByDate[dateKey(anchorDate)] ?? []
  const selectedJobs = selectedDate ? jobsByDate[dateKey(selectedDate)] ?? [] : []
  const selectedLabel = selectedDate
    ? selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : ""

  const headerLabel = useMemo(() => {
    if (viewMode === "today") {
      return `Today · ${anchorDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`
    }
    if (viewMode === "week") {
      const end = new Date(weekStart)
      end.setDate(end.getDate() + 6)
      const sameMonth = weekStart.getMonth() === end.getMonth() && weekStart.getFullYear() === end.getFullYear()
      const startStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      const endStr = sameMonth
        ? end.toLocaleDateString("en-US", { day: "numeric", year: "numeric" })
        : end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      return `${startStr} – ${endStr}`
    }
    return `${MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
  }, [viewMode, anchorDate, weekStart])

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

  function DayCell({ date, tall }: { date: Date; tall?: boolean }) {
    const isToday = isSameDay(date, today)
    const key = dateKey(date)
    const dayJobs = jobsByDate[key] ?? []
    const hasJobs = dayJobs.length > 0
    const showTip = hoveredKey === key && hasJobs && !tall
    const showMonthAbbrev = date.getDate() === 1

    return (
      <div
        className="relative"
        onMouseEnter={() => hasJobs && setHoveredKey(key)}
        onMouseLeave={() => setHoveredKey(null)}
        onClick={() => hasJobs && setSelectedDate(date)}
      >
        <div
          className={cn(
            "flex flex-col items-center gap-1 rounded-sm pt-1.5 transition-colors",
            tall ? "h-40" : "h-20",
            isToday ? "bg-primary text-white" : "hover:bg-surface-subtle",
            hasJobs && "cursor-pointer border-2 border-primary/30",
          )}
        >
          <span className={cn("text-xs font-medium leading-none", isToday ? "text-white" : "text-heading")}>
            {date.getDate()}{showMonthAbbrev ? ` ${MONTH_NAMES[date.getMonth()].slice(0, 3)}` : ""}
          </span>

          {tall ? (
            <div className="mt-1 flex w-full flex-1 flex-col gap-1 overflow-hidden px-1.5">
              {dayJobs.slice(0, 4).map((job) => (
                <div key={job.id} className="flex items-center gap-1 overflow-hidden">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusStyle(displayJobStatus(job.status, job.is_overdue)).dot)} />
                  <span className={cn("truncate text-[10px]", isToday ? "text-white" : "text-body")}>{job.customer}</span>
                </div>
              ))}
              {dayJobs.length > 4 && (
                <span className={cn("text-[10px]", isToday ? "text-white/80" : "text-muted")}>
                  +{dayJobs.length - 4} more
                </span>
              )}
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
        {showTip && <CompactTooltip jobs={dayJobs} />}
      </div>
    )
  }

  return (
    <Card className="overflow-hidden">
      {/* Teal header bar */}
      <div className="flex items-center justify-between bg-primary px-5 py-3 text-white">
        <h2 className="text-sm font-semibold">Calendar</h2>
        <div className="flex items-center gap-2">
          {viewMode !== "today" && (
            <button
              onClick={goPrev}
              aria-label="Previous"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-white/80 hover:bg-white/15"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <span className="min-w-28 text-center text-sm font-medium">{headerLabel}</span>
          {viewMode !== "today" && (
            <button
              onClick={goNext}
              aria-label="Next"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-white/80 hover:bg-white/15"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <Popover
            align="end"
            placement="bottom"
            panelClassName="w-32"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="ml-1 flex items-center gap-1 rounded-pill bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25"
              >
                {VIEW_OPTIONS.find((o) => o.key === viewMode)?.label}
                <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
              </button>
            )}
          >
            {(close) => (
              <>
                {VIEW_OPTIONS.map((o) => (
                  <MenuItem
                    key={o.key}
                    onClick={() => { handleViewChange(o.key); close() }}
                    className={cn(
                      "justify-center text-center",
                      o.key === viewMode && "bg-surface-muted font-semibold text-heading",
                    )}
                  >
                    {o.label}
                  </MenuItem>
                ))}
              </>
            )}
          </Popover>
        </div>
      </div>

      <CardBody className="flex flex-col gap-4">
        {viewMode === "today" && (
          todaysJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CalendarClock className="h-8 w-8 text-muted" />
              <p className="text-sm font-medium text-body">No jobs scheduled today</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {todaysJobs.map((job) => <JobDetailBlock key={job.id} job={job} />)}
            </div>
          )
        )}

        {viewMode === "week" && (
          <>
            <div className="grid grid-cols-7 gap-1">
              {DAY_HEADERS.map((day) => (
                <div key={day} className="py-1 text-center text-xs font-medium text-body">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekCells.map((date) => <DayCell key={dateKey(date)} date={date} tall />)}
            </div>
          </>
        )}

        {viewMode === "month" && (
          <>
            <div className="grid grid-cols-7 gap-1">
              {DAY_HEADERS.map((day) => (
                <div key={day} className="py-1 text-center text-xs font-medium text-body">
                  {day}
                </div>
              ))}
            </div>
            <div className="relative grid grid-cols-7 gap-1">
              {monthCells.map((date, idx) =>
                date === null
                  ? <div key={`empty-${idx}`} className="h-20" />
                  : <DayCell key={dateKey(date)} date={date} />
              )}
            </div>
          </>
        )}

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
        open={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        title={selectedLabel}
        description={`${selectedJobs.length} job${selectedJobs.length !== 1 ? "s" : ""} scheduled`}
        size="md"
      >
        <div className="divide-y divide-border-subtle">
          {selectedJobs.map((job) => <JobDetailBlock key={job.id} job={job} />)}
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
