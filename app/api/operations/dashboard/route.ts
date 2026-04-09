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
         scheduled_end,
         duration_hours,
         created_at,
         assigned_team_id,
         customer:customer_id(full_name),
         team:assigned_team_id(team_id, team_name, team_lead:team_lead_id(full_name))`
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

    // Calendar jobs with team and duration information
    const calendar_jobs = rows
      .filter((r: any) => r.scheduled_start)
      .map((r: any) => ({
        scheduled_start: r.scheduled_start,
        scheduled_end: r.scheduled_end,
        status: r.current_status,
        team_id: r.assigned_team_id,
        team_name: r.team?.team_name ?? "Unassigned",
        team_lead: r.team?.team_lead_id?.full_name ?? null,
        duration_hours: r.duration_hours ?? null,
        job_order_id: r.job_order_id,
      }))

    // Pending intake count (disabled feature, return 0)
    const pending_intakes_count = 0

    return NextResponse.json({ status_counts, recent_jobs, calendar_jobs, pending_intakes_count })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

