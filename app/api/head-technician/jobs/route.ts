import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // Determine the user's role
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

    // Find job IDs assigned to this user via job_order_team
    const { data: teamRows } = await admin
      .from("job_order_team")
      .select("job_order_id")
      .eq("user_account_id", user.id)
      .eq("role_in_job", role)

    const jobIds = (teamRows ?? []).map((t: any) => t.job_order_id)
    if (jobIds.length === 0) return NextResponse.json({ jobs: [] })

    const { data: jobs, error } = await admin
      .from("job_order")
      .select(
        `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at,
         customer:customer_record_id(full_name, plate_number, vehicle_unit),
         service:service_id(name),
         customer_name, plate_number, vehicle_unit`
      )
      .in("id", jobIds)
      .not("status", "in", '("Released","Cancelled")')
      .order("scheduled_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Stage progress per job (filtered by relevant category)
    const { data: stages } = await admin
      .from("job_stage_progress")
      .select("job_order_id, status, stage:service_stage_id(category)")
      .in("job_order_id", jobIds)

    const relevantCategory = role === "head_detailer" ? "preparation" : "installation"
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
      return {
        id:            j.id,
        customer_name: j.customer?.full_name ?? j.customer_name ?? "—",
        plate_number:  j.customer?.plate_number ?? j.plate_number ?? "—",
        vehicle_unit:  j.customer?.vehicle_unit ?? j.vehicle_unit ?? "—",
        service:       j.service?.name ?? "—",
        status:        j.status,
        scheduled_at:  j.scheduled_at,
        progress:      prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0,
      }
    })

    return NextResponse.json({ jobs: result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
