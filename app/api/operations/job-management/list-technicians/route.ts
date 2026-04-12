import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Head detailers and head installers from user_account (system users who lead teams)
    const { data: heads, error: headsError } = await supabase
      .from("user_account")
      .select("id, full_name, role")
      .in("role", ["head_detailer", "head_installer"])
      .eq("is_archived", false)
      .order("role")
      .order("full_name")

    if (headsError) return NextResponse.json({ error: headsError.message }, { status: 500 })

    // Active job count per head (via job_order_team)
    const headIds = (heads ?? []).map((h: any) => h.id)
    const { data: activeTeam } = await supabase
      .from("job_order_team")
      .select("user_account_id, job_order:job_order_id(status)")
      .in("user_account_id", headIds)

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
      role:        h.role,
      source:      "user_account" as const,
      active_jobs: jobCountMap.get(h.id) ?? 0,
    }))

    return NextResponse.json({ technicians })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
