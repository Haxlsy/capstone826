import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { addWorkingMins } from "@/hooks/time-utils"
import { fmtDateTime } from "@/lib/time-display"

// Computes the expected completion for a prospective job order so the
// confirm-dialog preview is produced server-side (same engine that persists
// the estimate), never re-implemented in the browser.
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const body = await request.json()
    const startIso = (body?.startIso as string) ?? ""
    const durationMins = Number(body?.durationMins)

    if (!startIso || !Number.isFinite(durationMins) || durationMins <= 0) {
      return NextResponse.json(
        { error: "startIso and a positive durationMins are required." },
        { status: 400 }
      )
    }

    const start = new Date(startIso)
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid startIso." }, { status: 400 })
    }

    const expected = addWorkingMins(start, durationMins)
    return NextResponse.json({
      expected_iso:      expected.toISOString(),
      expected_display:  fmtDateTime(expected.toISOString()),
      scheduled_display: fmtDateTime(start.toISOString()),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
