import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

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
    const url    = new URL(request.url)
    const period = (url.searchParams.get("period") ?? "overall") as Period

    const admin  = createAdminClient()
    const since  = periodStart(period)

    let query = admin
      .from("job_order")
      .select("service:service_id ( name, service_type )")
      .eq("is_archived", false)
      .in("status", ["Pending", "Ongoing", "For Rework", "For Release", "Released"])

    if (since) {
      query = query.gte("created_at", since)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const countMap: Record<string, number> = {}
    for (const row of (data ?? []) as unknown as { service: { name: string; service_type?: string | null } | { name: string; service_type?: string | null }[] | null }[]) {
      const svcObj = Array.isArray(row.service) ? row.service[0] : row.service
      const label  = svcObj?.service_type?.trim() || svcObj?.name || "Unknown"
      countMap[label] = (countMap[label] ?? 0) + 1
    }

    const breakdown = Object.entries(countMap)
      .map(([service_name, count]) => ({ service_name, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ breakdown })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
