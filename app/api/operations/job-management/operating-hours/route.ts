import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRoleCaller } from "@/lib/auth/caller"
import { DEFAULT_OPERATING_DAYS, DEFAULT_OPERATING_OPEN_TIME, DEFAULT_OPERATING_CLOSE_TIME } from "@/types/chatbot"

// GET /api/operations/job-management/operating-hours
// The raw Operating Hours setting (Admin → AI Configuration), for Add Job
// Order's Scheduled Date & Time field — its display hint, its `min`, and its
// closed-day/outside-hours validation all read this, via the shared pure
// helpers in types/chatbot.ts (formatOperatingHours / isWithinOperatingHours)
// so this never drifts from what the chatbot and customer messages already
// promise. Raw fields, not lib/operating-hours.ts's WorkSchedule shape — the
// client needs the original days/strings to format and validate with those
// same helpers, not the server-side day-number/minutes form.
export async function GET() {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const admin = createAdminClient()
    const { data } = await admin.from("chatbot_config").select("settings").limit(1).single()
    const settings = data?.settings as Record<string, unknown> | null | undefined

    const operating_days = Array.isArray(settings?.operating_days) && settings.operating_days.length > 0
      ? settings.operating_days
      : DEFAULT_OPERATING_DAYS
    const operating_open_time = typeof settings?.operating_open_time === "string"
      ? settings.operating_open_time
      : DEFAULT_OPERATING_OPEN_TIME
    const operating_close_time = typeof settings?.operating_close_time === "string"
      ? settings.operating_close_time
      : DEFAULT_OPERATING_CLOSE_TIME

    return NextResponse.json({ operating_days, operating_open_time, operating_close_time })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
