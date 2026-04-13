import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Head detailers and head installers from user_account
    const { data: heads, error: headsError } = await supabase
      .from("user_account")
      .select("id, full_name, role")
      .in("role", ["head_detailer", "head_installer"])
      .eq("is_archived", false)
      .order("role")
      .order("full_name")

    if (headsError) return NextResponse.json({ error: headsError.message }, { status: 500 })

    const headIds = (heads ?? []).map((h: any) => h.id)

    // crew query is independent — run in parallel with activeTeam
    const [{ data: activeTeam }, { data: crew, error: crewError }] = await Promise.all([
      supabase
        .from("job_order_team")
        .select("user_account_id, job_order:job_order_id(status)")
        .in("user_account_id", headIds),
      supabase
        .from("technician")
        .select("id, full_name, role, is_available")
        .in("role", ["detailer", "installer"])
        .eq("is_archived", false)
        .order("role")
        .order("full_name"),
    ])

    if (crewError) return NextResponse.json({ error: crewError.message }, { status: 500 })

    const jobCountMap = new Map<string, number>()
    for (const t of activeTeam ?? []) {
      const job = t.job_order as any
      if (job && ["Pending", "Ongoing", "For Rework", "Delayed"].includes(job.status)) {
        const id = t.user_account_id as string
        jobCountMap.set(id, (jobCountMap.get(id) ?? 0) + 1)
      }
    }

    const technicians = (heads ?? []).map((h: any) => ({
      id:          h.id,
      full_name:   h.full_name,
      role:        h.role as "head_detailer" | "head_installer",
      source:      "user_account" as const,
      active_jobs: jobCountMap.get(h.id) ?? 0,
    }))

    const crew_members = (crew ?? []).map((c: any) => ({
      id:           c.id,
      full_name:    c.full_name,
      role:         c.role as "detailer" | "installer",
      source:       "technician" as const,
      is_available: c.is_available as boolean,
    }))

    return NextResponse.json({ technicians, crew_members })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
