import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRoleCaller } from "@/lib/auth/caller"
import { SERVICE_BREAKDOWN_STATUSES, fetchServiceBreakdown } from "@/lib/admin/service-breakdown"

type Period = "today" | "week" | "month" | "overall"

function periodStart(period: Period): string | null {
  const now = new Date()
  if (period === "today") {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    return d.toISOString()
  }
  if (period === "week") {
    const day = now.getUTCDay() // 0=Sun, 1=Mon...
    const diff = (day === 0 ? -6 : 1 - day) // back to Monday
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
    return d.toISOString()
  }
  if (period === "month") {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    return d.toISOString()
  }
  return null // overall — no filter
}

// GET /api/admin/dashboard/service-breakdown?period=today|week|month|overall
export async function GET(request: Request) {
  try {
    const auth = await getRoleCaller(["admin", "super_admin"])
    if ("error" in auth) return auth.error

    const url    = new URL(request.url)
    const period = (url.searchParams.get("period") ?? "overall") as Period

    const admin  = createAdminClient()
    const since  = periodStart(period)

    // Base status list is shared with the server-rendered first paint (see
    // lib/admin/service-breakdown.ts) — "Overall" must reproduce it exactly;
    // today/week/month narrow it further with `since`. Counted in Postgres
    // (service_breakdown_counts), not fetched row-by-row.
    const breakdown = await fetchServiceBreakdown(admin, { statuses: SERVICE_BREAKDOWN_STATUSES, since })

    return NextResponse.json({ breakdown })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
