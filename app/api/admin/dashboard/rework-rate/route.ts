import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

type Period = "today" | "week" | "month" | "all"

function getPeriodBounds(period: Period): { currentStart: Date | null; prevStart: Date | null; prevEnd: Date | null } {
  const now = new Date()
  if (period === "all") return { currentStart: null, prevStart: null, prevEnd: null }

  if (period === "today") {
    const todayStart     = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    return { currentStart: todayStart, prevStart: yesterdayStart, prevEnd: todayStart }
  }

  const days = period === "week" ? 7 : 30
  const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const prevStart    = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000)
  return { currentStart, prevStart, prevEnd: currentStart }
}

async function computeReworkStats(
  supabase: ReturnType<typeof createAdminClient>,
  start: Date | null,
  end: Date | null
): Promise<{ total_completed: number; rework_count: number; rework_rate: number }> {
  let query = supabase
    .from("job_order")
    .select("id")
    .eq("status", "Released")
    .eq("is_archived", false)

  if (start) query = query.gte("created_at", start.toISOString())
  if (end)   query = query.lt("created_at", end.toISOString())

  const { data: jobs, error } = await query
  if (error) throw new Error(error.message)

  const jobIds          = (jobs ?? []).map((j) => j.id as string)
  const total_completed = jobIds.length

  if (total_completed === 0) return { total_completed: 0, rework_count: 0, rework_rate: 0 }

  const { data: historyRows, error: histError } = await supabase
    .from("job_order_history")
    .select("job_order_id")
    .in("job_order_id", jobIds)
    .eq("status", "For Rework")

  if (histError) throw new Error(histError.message)

  const reworkJobIds = new Set((historyRows ?? []).map((r) => r.job_order_id as string))
  const rework_count = reworkJobIds.size
  const rework_rate  = Math.round((rework_count / total_completed) * 100)

  return { total_completed, rework_count, rework_rate }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const raw    = searchParams.get("period") ?? "week"
    const period = (["today", "week", "month", "all"].includes(raw) ? raw : "week") as Period

    const supabase = createAdminClient()
    const { currentStart, prevStart, prevEnd } = getPeriodBounds(period)

    const current = await computeReworkStats(supabase, currentStart, null)

    let trend: number | null = null
    if (period !== "all" && prevStart !== null) {
      const prev = await computeReworkStats(supabase, prevStart, prevEnd)
      trend = current.rework_rate - prev.rework_rate
    }

    return NextResponse.json({ ...current, trend })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}