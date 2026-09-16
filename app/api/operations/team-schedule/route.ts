import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRoleCaller } from "@/lib/auth/caller"

// GET /api/operations/team-schedule
// Returns Pending + Ongoing jobs with their full assigned team and schedule times.
// Used by the Operations Dashboard TeamSchedulePanel.
export async function GET() {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const supabase = createAdminClient()

    // 1. Fetch Pending + Ongoing jobs with schedule fields
    const { data: jobs, error } = await supabase
      .from("job_order")
      .select(
        `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at, job_order_code,
         customer:customer_record_id(full_name),
         service:service_id(name),
         customer_name`
      )
      .in("status", ["Pending", "Ongoing"])
      .order("scheduled_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const jobIds = (jobs ?? []).map((j: any) => j.id)

    if (jobIds.length === 0) return NextResponse.json({ teams: [] })

    // 2. Fetch all team assignments for those jobs in one query
    const { data: teamRows } = await supabase
      .from("job_order_team")
      .select(
        "job_order_id, role_in_job, user_account:user_account_id(id, full_name), technician:technician_id(id, full_name)"
      )
      .in("job_order_id", jobIds)

    // 3. Build team map per job
    const teamMap = new Map<string, {
      head_detailer:  string | null
      head_installer: string | null
      detailers:      string[]
      installers:     string[]
    }>()

    for (const t of teamRows ?? []) {
      if (!teamMap.has(t.job_order_id)) {
        teamMap.set(t.job_order_id, {
          head_detailer: null, head_installer: null, detailers: [], installers: [],
        })
      }
      const entry = teamMap.get(t.job_order_id)!
      const ua    = (t.user_account as any)?.full_name ?? null
      const tech  = (t.technician  as any)?.full_name ?? null

      if (t.role_in_job === "head_detailer"  && ua)   entry.head_detailer  = ua
      if (t.role_in_job === "head_installer" && ua)   entry.head_installer = ua
      if (t.role_in_job === "detailer"       && tech) entry.detailers.push(tech)
      if (t.role_in_job === "installer"      && tech) entry.installers.push(tech)
    }

    // 4. Shape the response
    const teams = (jobs ?? []).map((j: any) => {
      const team = teamMap.get(j.id) ?? {
        head_detailer: null, head_installer: null, detailers: [], installers: [],
      }
      return {
        job_id:                  j.id,
        display_id:              j.job_order_code,
        customer:                (j.customer as any)?.full_name ?? j.customer_name ?? "—",
        service:                 (j.service  as any)?.name ?? "—",
        status:                  j.status,
        scheduled_at:            j.scheduled_at,
        actual_start_at:         j.actual_start_at,
        expected_completion_at:  j.expected_completion_at,
        ...team,
      }
    })

    return NextResponse.json({ teams })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
