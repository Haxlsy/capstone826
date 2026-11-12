import { isAvailableOn, manilaDayOf, type TechnicianAvailabilityInput } from "@/lib/technician-availability"

/**
 * "Does this job order have an available head technician?" The one rule behind
 * the warning on Operations' job order detail and job order list, so the two
 * can never disagree.
 *
 * A head role on a job is covered when ANY head assigned to that role (the
 * primary or a substitute) is available on the job's working day. When none
 * is, the job warns so Operations can assign a substitute.
 */

export type HeadRole = "head_detailer" | "head_installer"

/** Statuses where a head technician is still doing the work. */
export const HEAD_WORK_STATUSES = ["Pending", "Ongoing", "For Rework"] as const

export interface HeadOnJob extends TechnicianAvailabilityInput {
  id: string
  full_name: string
  /** The account's current role (it may have changed since it was assigned). */
  role: string
  is_archived: boolean
  /** The slot on the job this head fills. */
  role_in_job: HeadRole
}

export interface UnavailableHead {
  id: string
  name: string
  reason: "archived" | "not_head" | "off_today" | "not_scheduled"
}

export interface HeadWarning {
  role: HeadRole
  /** The Manila day the job was judged on: today, or its future scheduled day. */
  day: { dateKey: string; dayName: string; isToday: boolean }
  heads: UnavailableHead[]
}

/** The day that matters for a job: its scheduled day if that's still ahead, otherwise today. */
export function jobWorkingDay(scheduledAt: string | null | undefined, now: Date = new Date()) {
  const today = manilaDayOf(now)
  if (scheduledAt) {
    const scheduled = manilaDayOf(scheduledAt)
    if (scheduled.dateKey > today.dateKey) return { ...scheduled, isToday: false }
  }
  return { ...today, isToday: true }
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * The working day for a date picked in a form ("YYYY-MM-DD", already a Manila
 * date): that day if it's still ahead, otherwise today (same rule as above).
 */
export function workingDayFromDateKey(dateKey: string | null | undefined, now: Date = new Date()) {
  const today = manilaDayOf(now)
  const key = dateKey?.slice(0, 10)
  if (key && /^\d{4}-\d{2}-\d{2}$/.test(key) && key > today.dateKey) {
    const [y, m, d] = key.split("-").map(Number)
    return { dateKey: key, dayName: DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], isToday: false }
  }
  return { ...today, isToday: true }
}

/** Why a head can't cover the job that day, or null when they can. */
export function headUnavailableReason(
  head: HeadOnJob,
  day: { dateKey: string; dayName: string },
): UnavailableHead["reason"] | null {
  if (head.is_archived) return "archived"
  if (head.role !== head.role_in_job) return "not_head"
  if (isAvailableOn(head, day)) return null
  return head.availability_override_date === day.dateKey ? "off_today" : "not_scheduled"
}

export function headCoverage(
  job: { status: string; scheduled_at: string | null },
  heads: HeadOnJob[],
  now: Date = new Date(),
): HeadWarning[] {
  if (!(HEAD_WORK_STATUSES as readonly string[]).includes(job.status)) return []
  const day = jobWorkingDay(job.scheduled_at, now)

  const warnings: HeadWarning[] = []
  for (const role of ["head_detailer", "head_installer"] as const) {
    const assigned = heads.filter((h) => h.role_in_job === role)
    // A job with no head for this role doesn't need one (its stages don't use that team).
    if (assigned.length === 0) continue
    const unavailable: UnavailableHead[] = []
    let covered = false
    for (const h of assigned) {
      const reason = headUnavailableReason(h, day)
      if (reason === null) { covered = true; break }
      unavailable.push({ id: h.id, name: h.full_name, reason })
    }
    if (!covered) warnings.push({ role, day, heads: unavailable })
  }
  return warnings
}

const ROLE_TEXT: Record<HeadRole, string> = { head_detailer: "Head Detailer", head_installer: "Head Installer" }

/** "Tue, Nov 17" from a Manila date key. */
function shortDay(dateKey: string, dayName: string): string {
  const [, m, d] = dateKey.split("-").map(Number)
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]
  return `${dayName}, ${month} ${d}`
}

/** One plain sentence for a warning, shared by the banner and the list's tooltip. */
export function headWarningText(w: HeadWarning): string {
  const role = ROLE_TEXT[w.role]
  const when = w.day.isToday ? "today" : `on ${shortDay(w.day.dateKey, w.day.dayName)}`
  const names = w.heads.map((h) => h.name).join(", ")
  const plural = w.heads.length > 1
  const noLongerHead = w.heads.every((h) => h.reason === "archived" || h.reason === "not_head")
  const why = noLongerHead
    ? `${plural ? "are" : "is"} no longer an active head technician`
    : `${plural ? "aren't" : "isn't"} available ${when}`
  return `${role}${plural ? "s" : ""} ${names} ${why}. Assign a substitute ${role.toLowerCase()} for this job.`
}

/** Short label for a head in a picker, judged on a given day; null when available. */
export function headPickerNote(
  head: TechnicianAvailabilityInput,
  day: { dateKey: string; dayName: string; isToday: boolean },
): string | null {
  if (isAvailableOn(head, day)) return null
  if (day.isToday) return "Unavailable today"
  return `Not scheduled on ${shortDay(day.dateKey, day.dayName)}`
}
