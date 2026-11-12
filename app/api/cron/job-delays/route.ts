import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { runDelayAlertCheck } from "@/lib/job-delay-alerts"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * GET /api/cron/job-delays: announces newly delayed jobs and stages (bell +
 * web push) to the head technicians and Operations. Called every 5 minutes by
 * Vercel Cron (vercel.json), which sends `Authorization: Bearer <CRON_SECRET>`
 * once CRON_SECRET is set in the Vercel project. See lib/job-delay-alerts.ts.
 */
function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(header ?? "")
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 })
  }
  if (!authorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const result = await runDelayAlertCheck(createAdminClient())
    if (result.alerted > 0) console.info(`[cron/job-delays] ${result.alerted} new delay alert(s) across ${result.checked} active job(s)`)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[cron/job-delays] failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
