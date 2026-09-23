import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRoleCaller } from "@/lib/auth/caller"
import { loadOperatingHoursSettings } from "@/lib/operating-hours"

// GET /api/operations/job-management/operating-hours
// The raw Operating Hours setting (Admin → AI Configuration), for Add Job
// Order's and Job Order Detail's edit-Scheduled-Start Scheduled Date & Time
// fields — their display hint, their `min`, and their closed-day/
// outside-hours validation all read this, via the shared pure helpers in
// types/chatbot.ts (formatOperatingHours / isWithinOperatingHours) so this
// never drifts from what the chatbot and customer messages already promise.
// Raw fields, not lib/operating-hours.ts's WorkSchedule shape — the client
// needs the original days/strings to format and validate with those same
// helpers, not the server-side day-number/minutes form.
export async function GET() {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const admin = createAdminClient()
    const settings = await loadOperatingHoursSettings(admin)
    return NextResponse.json(settings)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
