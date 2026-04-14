import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()

    // All job orders with schedule fields
    const { data: jobs, error } = await supabase
      .from("job_order")
      .select(
        `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at,
         customer:customer_record_id(full_name),
         service:service_id(name)`
      )
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows   = jobs ?? []
    const jobIds = rows.map((j: any) => j.id)

    // Head detailer + head installer for calendar tooltip enrichment
    const { data: teamRows } = await supabase
      .from("job_order_team")
      .select("job_order_id, role_in_job, user_account:user_account_id(full_name)")
      .in("job_order_id", jobIds)
      .in("role_in_job", ["head_detailer", "head_installer"])

    const teamMap = new Map<string, { head_detailer: string | null; head_installer: string | null }>()
    for (const t of teamRows ?? []) {
      const entry = teamMap.get(t.job_order_id) ?? { head_detailer: null, head_installer: null }
      const name  = (t.user_account as any)?.full_name ?? null
      if (t.role_in_job === "head_detailer")  entry.head_detailer  = name
      if (t.role_in_job === "head_installer") entry.head_installer = name
      teamMap.set(t.job_order_id, entry)
    }

    // Status counts — keys normalised to snake_case to match the frontend STATUS_CONFIG keys
    const STATUS_LABEL_TO_KEY: Record<string, string> = {
      "Pending":    "pending",
      "Ongoing":    "ongoing",
      "For Rework": "for_rework",
      "For Release":"for_release",
      "Released":   "released",
      "Delayed":    "delayed",
      "Cancelled":  "cancelled",
    }
    const status_counts: Record<string, number> = Object.fromEntries(
      Object.values(STATUS_LABEL_TO_KEY).map((k) => [k, 0])
    )
    for (const row of rows) {
      const key = STATUS_LABEL_TO_KEY[row.status as string]
      if (key) status_counts[key]++
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

    // Calendar jobs — enriched with timing + team
    const calendar_jobs = rows
      .filter((r: any) => r.scheduled_at)
      .map((r: any) => {
        const team = teamMap.get(r.id) ?? { head_detailer: null, head_installer: null }
        return {
          id:                     r.id,
          scheduled_at:           r.scheduled_at,
          actual_start_at:        r.actual_start_at,
          expected_completion_at: r.expected_completion_at,
          status:                 r.status,
          customer:               r.customer?.full_name ?? "Manual Entry",
          service:                r.service?.name ?? "—",
          head_detailer:          team.head_detailer,
          head_installer:         team.head_installer,
        }
      })

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
