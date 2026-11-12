"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ChevronDown, CalendarClock, User } from "lucide-react"
import { Card, CardBody } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { JobStatusBadges } from "@/components/ui/Badge"
import { Popover, MenuItem } from "@/components/ui/Popover"
import { Sk } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { statusStyle } from "@/lib/ui/status"
import { fmtDateTimeShort } from "@/lib/time-display"
import { displayJobStatus } from "@/lib/job-delay"
import { tooltipAlign, placeCalendarTooltip, type Box } from "@/lib/ui/calendar-tooltip"
import { getInitials } from "@/hooks/useCurrentUser"

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
  job_order_code?: string | null
  plate?: string | null
  vehicle?: string | null
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

/**
 * The hover card for a day. Rendered on document.body with fixed coordinates
 * (see placeCalendarTooltip) rather than inside the calendar card, whose
 * overflow-hidden used to cut it off on the month's bottom rows. It starts
 * hidden, is measured once mounted, then placed.
 *
 * It takes the mouse: React treats a portal as part of its parent, so moving
 * onto the card counts as still hovering the day (and a click on it opens the
 * day's details, like clicking the day). The short delay in scheduleHide
 * covers the gap between the day and the card.
 */
function CompactTooltip({ jobs, align = "left", anchor }: { jobs: CalendarJob[]; align?: "left" | "right"; anchor: Box }) {
  const place = (el: HTMLDivElement | null) => {
    if (!el) return
    const size = el.getBoundingClientRect()
    const pos = placeCalendarTooltip(anchor, size, { width: window.innerWidth, height: window.innerHeight }, align)
    el.style.top = `${pos.top}px`
    el.style.left = `${pos.left}px`
    el.style.visibility = "visible"
  }

  return createPortal(
    <div
      ref={place}
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      data-calendar-tip=""
      className="z-[90] hidden w-52 cursor-pointer md:block rounded-card border border-border-subtle bg-surface py-2 shadow-pop"
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
              <JobStatusBadges status={job.status} isOverdue={job.is_overdue} stacked className="text-[10px]" />
            </div>
          )
        })}
      </div>
      <p className="mt-1 border-t border-border-subtle px-3 pt-1.5 text-center text-[10px] text-muted">
        Click for full details
      </p>
    </div>,
    document.body,
  )
}

/** A head technician on a job card: initials avatar, name, and role. */
function TeamMember({ name, role }: { name: string | null; role: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {name ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
          {getInitials(name)}
        </span>
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted">
          <User className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <p className={cn("truncate pr-1 text-xs", name ? "font-medium text-heading" : "italic text-muted")}>
          {name ?? "Unassigned"}
        </p>
        <p className="text-[11px] text-muted">{role}</p>
      </div>
    </div>
  )
}

/** One cell of the job card's time strip: a small label over its value. */
function TimeCell({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "muted" | "late" }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-xs",
          tone === "muted" ? "italic text-muted" : tone === "late" ? "font-medium text-status-delayed" : "font-medium text-heading",
        )}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * One job in the day-details modal and in "Today's jobs": job code and plate,
 * customer, service and vehicle, the two heads, then the times. Clicking it
 * opens the job order's details; its Back link returns to the dashboard.
 */
function JobDetailBlock({ job }: { job: CalendarJob }) {
  const isDelayed = displayJobStatus(job.status, job.is_overdue) === "Delayed"
  const ids = [job.job_order_code, job.plate].filter(Boolean).join(" · ")
  const subtitle = [job.service !== "—" ? job.service : null, job.vehicle].filter(Boolean).join(" · ")

  return (
    <Link
      href={`/dashboard/job-management/${job.id}?from=dashboard`}
      aria-label={`View job order details for ${job.customer}`}
      className="group relative -mx-3 block cursor-pointer rounded-card px-3 py-4 transition-shadow hover:bg-surface-subtle/40 hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {/* Hover hint, centred on the block's top edge so it never covers its content. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm bg-heading px-2 py-0.5 text-[11px] font-medium text-white opacity-0 shadow-pop transition-opacity group-hover:opacity-100"
      >
        Click to view job order details
      </span>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {ids && <p className="truncate font-mono text-[11px] text-muted">{ids}</p>}
          <p className="mt-0.5 truncate text-sm font-semibold text-heading">{job.customer}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <JobStatusBadges status={job.status} isOverdue={job.is_overdue} />
      </div>

      {/* Each head is centred in its half of the card. */}
      <div className="mt-3 grid grid-cols-2 justify-items-center gap-3">
        <TeamMember name={job.head_detailer} role="Detailer" />
        <TeamMember name={job.head_installer} role="Installer" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border-subtle pt-3">
        <TimeCell label="Scheduled" value={fmtDateTimeShort(job.scheduled_at)} />
        <TimeCell
          label="Started"
          value={job.actual_start_at ? fmtDateTimeShort(job.actual_start_at) : "Not started"}
          tone={job.actual_start_at ? "default" : "muted"}
        />
        <TimeCell
          label="Est. End"
          value={job.expected_completion_at ? fmtDateTimeShort(job.expected_completion_at) : "—"}
          tone={!job.expected_completion_at ? "muted" : isDelayed ? "late" : "default"}
        />
      </div>
    </Link>
  )
}

interface Props {
  loading: boolean
  calendarJobs: CalendarJob[]
}

export default function JobCalendarView({ loading, calendarJobs }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  // The hovered day and where its cell is on screen, for placing its hover card.
  const [hovered, setHovered] = useState<{ key: string; rect: Box } | null>(null)
  const hoveredKey = hovered?.key ?? null

  // Leaving a day hides its card after a short delay, so the mouse can cross
  // the gap onto the card; coming back (to the day or the card) cancels it.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = null
  }
  const scheduleHide = () => {
    cancelHide()
    hideTimer.current = setTimeout(() => setHovered(null), 200)
  }
  useEffect(() => cancelHide, [])

  // The card is fixed on screen, so hide it when the page scrolls or resizes
  // instead of letting it drift away from its day. Scrolling the card's own
  // job list doesn't count.
  useEffect(() => {
    if (!hovered) return
    const hide = (e: Event) => {
      const target = e.target
      if (target instanceof Element && target.closest("[data-calendar-tip]")) return
      setHovered(null)
    }
    window.addEventListener("scroll", hide, true)
    window.addEventListener("resize", hide)
    return () => {
      window.removeEventListener("scroll", hide, true)
      window.removeEventListener("resize", hide)
    }
  }, [hovered])
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
        <CardBody className="flex flex-col gap-4 p-3 sm:p-5">
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
        onMouseEnter={(e) => {
          // An empty day leaves the pending hide running, so crossing one
          // on the way to the card doesn't keep a stale card open.
          if (!hasJobs) return
          cancelHide()
          const r = e.currentTarget.getBoundingClientRect()
          setHovered((prev) =>
            prev?.key === key ? prev : { key, rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } },
          )
        }}
        onMouseLeave={scheduleHide}
        onClick={() => hasJobs && setSelectedDate(date)}
      >
        <div
          className={cn(
            "flex flex-col items-center gap-1 rounded-sm pt-1.5 transition-colors",
            tall ? "h-32 sm:h-40" : "h-16 sm:h-20",
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
                  <span className={cn("hidden truncate text-[10px] sm:inline", isToday ? "text-white" : "text-body")}>{job.customer}</span>
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
                  {dayJobs.length}<span className="hidden sm:inline"> job{dayJobs.length !== 1 ? "s" : ""}</span>
                </span>
              )}
            </>
          )}
        </div>
        {showTip && hovered && <CompactTooltip jobs={dayJobs} align={tooltipAlign(date.getDay())} anchor={hovered.rect} />}
      </div>
    )
  }

  return (
    <Card className="overflow-hidden">
      {/* Teal header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-primary px-4 py-3 text-white sm:px-5">
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

      <CardBody className="flex flex-col gap-4 p-3 sm:p-5">
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
                  ? <div key={`empty-${idx}`} className="h-16 sm:h-20" />
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
