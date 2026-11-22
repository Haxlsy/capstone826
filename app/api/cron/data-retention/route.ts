import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { runRetention } from "@/lib/retention/run"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * GET /api/cron/data-retention: deletes records past the retention period and
 * sends the weekly digest. Called daily by Vercel Cron (vercel.json) with
 * `Authorization: Bearer <CRON_SECRET>`. Runs as a dry run (counts only)
 * unless RETENTION_DRY_RUN is set to "false". See lib/retention/run.ts.
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
    const result = await runRetention(createAdminClient())
    console.info(`[cron/data-retention] ${result.dryRun ? "dry run" : "deleted"}:`, JSON.stringify(result.counts), "digest:", result.digest.sentTo.join(",") || "none")
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[cron/data-retention] failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
