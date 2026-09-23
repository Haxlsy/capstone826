import type { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_SCHEDULE, type WorkSchedule } from "@/hooks/time-utils"
import { WEEKDAYS, DEFAULT_OPERATING_DAYS, DEFAULT_OPERATING_OPEN_TIME, DEFAULT_OPERATING_CLOSE_TIME, type Weekday } from "@/types/chatbot"

// Date#getUTCDay() convention: 0=Sun .. 6=Sat.
const WEEKDAY_TO_JS_DAY: Record<Weekday, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

function parseHHMM(value: string, fallbackMinutes: number): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!m) return fallbackMinutes
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Loads the shop's configured working hours — Admin → AI Configuration's
 * Operating Hours setting (`chatbot_config.settings`), the same one the
 * chatbot and pickup-ready messages already use — as the `WorkSchedule`
 * `hooks/time-utils.ts`'s `addWorkingMins()` needs. Every job-scheduling
 * estimate and delay check reads it via this one function, so there's a
 * single place that resolves the setting and falls back safely.
 *
 * Falls back to `DEFAULT_SCHEDULE` (today's previously-hardcoded 8 AM-8 PM,
 * every day) when the config row, or these specific fields, aren't there —
 * a missing/legacy config can never break job scheduling.
 */
export async function loadWorkSchedule(
  admin: ReturnType<typeof createAdminClient>,
): Promise<WorkSchedule> {
  const { data } = await admin.from("chatbot_config").select("settings").limit(1).single()
  const settings = data?.settings as Record<string, unknown> | null | undefined

  const rawDays = Array.isArray(settings?.operating_days) ? (settings!.operating_days as Weekday[]) : null
  const days = (rawDays && rawDays.length > 0 ? rawDays : DEFAULT_OPERATING_DAYS)
    .filter((d): d is Weekday => (WEEKDAYS as string[]).includes(d))

  const openDays = new Set(days.map((d) => WEEKDAY_TO_JS_DAY[d]))
  if (openDays.size === 0) return DEFAULT_SCHEDULE // guard against a corrupt/empty saved list

  const openMinutes = parseHHMM(
    typeof settings?.operating_open_time === "string" ? settings.operating_open_time : DEFAULT_OPERATING_OPEN_TIME,
    DEFAULT_SCHEDULE.openMinutes,
  )
  const closeMinutes = parseHHMM(
    typeof settings?.operating_close_time === "string" ? settings.operating_close_time : DEFAULT_OPERATING_CLOSE_TIME,
    DEFAULT_SCHEDULE.closeMinutes,
  )
  if (closeMinutes <= openMinutes) return DEFAULT_SCHEDULE // guard against a corrupt saved range

  return { openDays, openMinutes, closeMinutes }
}

export interface OperatingHoursSettings {
  operating_days: Weekday[]
  operating_open_time: string
  operating_close_time: string
}

/**
 * The same Operating Hours setting as `loadWorkSchedule`, but in its raw
 * (Weekday[] + "HH:MM") form instead of `WorkSchedule`'s internal
 * day-number/minutes shape — what a caller needs to pass to
 * `isWithinOperatingHours`/`formatOperatingHours` (types/chatbot.ts), e.g. to
 * validate or display a Scheduled Date & Time input server-side. Shared by
 * `/api/operations/job-management/operating-hours` (the client's own fetch)
 * and any route that needs to validate a scheduled_at server-side.
 */
export async function loadOperatingHoursSettings(
  admin: ReturnType<typeof createAdminClient>,
): Promise<OperatingHoursSettings> {
  const { data } = await admin.from("chatbot_config").select("settings").limit(1).single()
  const settings = data?.settings as Record<string, unknown> | null | undefined

  const operating_days = Array.isArray(settings?.operating_days) && settings.operating_days.length > 0
    ? (settings.operating_days as Weekday[])
    : DEFAULT_OPERATING_DAYS
  const operating_open_time = typeof settings?.operating_open_time === "string"
    ? settings.operating_open_time
    : DEFAULT_OPERATING_OPEN_TIME
  const operating_close_time = typeof settings?.operating_close_time === "string"
    ? settings.operating_close_time
    : DEFAULT_OPERATING_CLOSE_TIME

  return { operating_days, operating_open_time, operating_close_time }
}
