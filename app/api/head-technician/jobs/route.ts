import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"


function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from("user_account")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 })

    const role = profile.role as string
    if (role !== "head_detailer" && role !== "head_installer") {
      return NextResponse.json({ jobs: [] })
    }

    // Fetch job IDs this user is assigned to
    const { data: teamRows } = await admin
      .from("job_order_team")
      .select("job_order_id")
      .eq("user_account_id", user.id)

    const jobIds = (teamRows ?? []).map((t: any) => t.job_order_id)

    if (jobIds.length === 0) return NextResponse.json({ jobs: [] })

    // ── Real DB path ────────────────────────────────────────────────────────
    const { data: jobs, error } = await admin
      .from("job_order")
      .select(`
        id, status, scheduled_at, created_at,
        customer:customer_record_id(full_name, plate_number, vehicle_unit),
        service:service_id(name),
        customer_name, plate_number, vehicle_unit
      `)
      .in("id", jobIds)
      .not("status", "in", '("Released","Cancelled")')
      .order("scheduled_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Technician name per job
    const { data: allTeam } = await admin
      .from("job_order_team")
      .select("job_order_id, role_in_job, user_account:user_account_id(full_name)")
      .in("job_order_id", jobIds)

    // Stage progress filtered by this role's category
    const relevantCategory = role === "head_detailer" ? "preparation" : "installation"
    const { data: stages } = await admin
      .from("job_stage_progress")
      .select("job_order_id, status, stage:service_stage_id(category)")
      .in("job_order_id", jobIds)

    const progressMap = new Map<string, { total: number; done: number }>()
    for (const s of stages ?? []) {
      const stg = s.stage as any
      if (stg?.category !== relevantCategory) continue
      const entry = progressMap.get(s.job_order_id) ?? { total: 0, done: 0 }
      entry.total++
      if (s.status === "done") entry.done++
      progressMap.set(s.job_order_id, entry)
    }

    const result = (jobs ?? []).map((j: any) => {
      const prog = progressMap.get(j.id) ?? { total: 0, done: 0 }
      const member = (allTeam ?? []).find(
        (t: any) => t.job_order_id === j.id && t.role_in_job === role
      )
      const year = j.created_at ? new Date(j.created_at).getFullYear() : new Date().getFullYear()
      const seq  = String(jobIds.indexOf(j.id) + 1).padStart(3, "0")

      return {
        job_id:           `JO-${year}-${seq}`,
        raw_id:           j.id as string,       // UUID — matches detail route lookup
        customer_name:    (j.customer as any)?.full_name    ?? j.customer_name ?? "—",
        plate_number:     (j.customer as any)?.plate_number ?? j.plate_number  ?? "—",
        car_make:         (j.customer as any)?.vehicle_unit ?? j.vehicle_unit  ?? "—",
        car_color:        "",
        service:          (j.service as any)?.name          ?? "—",
        technician_name:  (member?.user_account as any)?.full_name ?? "Unassigned",
        scheduled_start:  fmtDate(j.scheduled_at),
        status:           j.status,
        progress:         prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0,
      }
    })

    return NextResponse.json({ jobs: result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
