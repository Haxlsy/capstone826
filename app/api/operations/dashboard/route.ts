import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase
      .from("job_order")
      .select(
        `job_order_id,
         current_status,
         scheduled_start,
         created_at,
         customer:customer_id(full_name)`
      )
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data ?? []

    // Status counts
    const STATUS_KEYS = ["pending", "ongoing", "quality_check", "completed", "delayed", "released", "cancelled"]
    const status_counts: Record<string, number> = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]))
    for (const row of rows) {
      const s = row.current_status as string
      if (s in status_counts) status_counts[s]++
    }

    // Recent job orders (latest 5)
    const recent_jobs = rows.slice(0, 5).map((r: any) => ({
      job_order_id: r.job_order_id,
      id: `JO-${new Date(r.created_at).getFullYear()}-${String(r.job_order_id).padStart(3, "0")}`,
      customer: r.customer?.full_name ?? `Customer #${r.job_order_id}`,
      status: r.current_status,
      created_at: r.created_at,
    }))

    // Calendar jobs (scheduled_start + status for dot rendering)
    const calendar_jobs = rows
      .filter((r: any) => r.scheduled_start)
      .map((r: any) => ({
        scheduled_start: r.scheduled_start,
        status: r.current_status,
      }))

    return NextResponse.json({ status_counts, recent_jobs, calendar_jobs })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
