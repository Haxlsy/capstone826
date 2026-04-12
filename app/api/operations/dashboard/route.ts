import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()

    // All job orders
    const { data: jobs, error } = await supabase
      .from("job_order")
      .select(
        `id, status, scheduled_at, created_at,
         customer:customer_record_id(full_name),
         service:service_id(name)`
      )
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = jobs ?? []

    // Status counts
    const STATUS_KEYS = ["Pending", "Ongoing", "For Rework", "For Release", "Released", "Delayed", "Cancelled"]
    const status_counts: Record<string, number> = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]))
    for (const row of rows) {
      const s = row.status as string
      if (s in status_counts) status_counts[s]++
    }

    // Open concern count
    const { count: concern_count } = await supabase
      .from("concern")
      .select("id", { count: "exact", head: true })
      .eq("status", "Pending")

    // Recent jobs (latest 5)
    const recent_jobs = rows.slice(0, 5).map((r: any) => ({
      id:         r.id,
      customer:   r.customer?.full_name ?? "Manual Entry",
      service:    r.service?.name ?? "—",
      status:     r.status,
      created_at: r.created_at,
    }))

    // Calendar jobs
    const calendar_jobs = rows
      .filter((r: any) => r.scheduled_at)
      .map((r: any) => ({
        id:           r.id,
        scheduled_at: r.scheduled_at,
        status:       r.status,
        customer:     r.customer?.full_name ?? "Manual Entry",
        service:      r.service?.name ?? "—",
      }))

    return NextResponse.json({
      status_counts,
      concern_count: concern_count ?? 0,
      recent_jobs,
      calendar_jobs,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
