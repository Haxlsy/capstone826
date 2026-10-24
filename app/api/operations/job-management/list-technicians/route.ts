import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRoleCaller } from "@/lib/auth/caller"

export async function GET() {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

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

    const ACTIVE_STATUSES = ["Pending", "Ongoing", "For Rework", "Delayed"]

    // Fetch active job IDs first, then fan out — avoids unreliable FK join syntax
    const { data: activeJobs } = await supabase
      .from("job_order")
      .select("id")
      .in("status", ACTIVE_STATUSES)

    const activeJobIds = (activeJobs ?? []).map((j: any) => j.id as string)

    // All remaining queries are independent — run in parallel
    const [
      { data: crew, error: crewError },
      { data: headTeamRows },
      { data: crewTeamRows },
    ] = await Promise.all([
      // Crew roster
      supabase
        .from("technician")
        .select("id, full_name, role, is_available, available_days, work_start_time, work_end_time, availability_override_date")
        .in("role", ["detailer", "installer"])
        .eq("is_archived", false)
        .order("role")
        .order("full_name"),
      // Head tech assignments on active jobs
      activeJobIds.length > 0
        ? supabase
            .from("job_order_team")
            .select("user_account_id")
            .in("job_order_id", activeJobIds)
            .in("user_account_id", headIds)
        : Promise.resolve({ data: [] }),
      // Crew assignments on active jobs
      activeJobIds.length > 0
        ? supabase
            .from("job_order_team")
            .select("technician_id, job_order_id")
            .in("job_order_id", activeJobIds)
            .not("technician_id", "is", null)
        : Promise.resolve({ data: [] }),
    ])

    if (crewError) {
      console.error("[list-technicians] crew query failed:", crewError.message)
      return NextResponse.json({ error: crewError.message }, { status: 500 })
    }

    // Head tech: count active jobs
    const jobCountMap = new Map<string, number>()
    for (const t of headTeamRows ?? []) {
      const id = t.user_account_id as string
      jobCountMap.set(id, (jobCountMap.get(id) ?? 0) + 1)
    }

    // Crew: count active jobs per technician. Crew can be on several jobs at
    // once (they work as a team), so this is shown as workload, not a block.
    // Distinct jobs: a primary and a substitute row on one job count once.
    const crewJobs = new Map<string, Set<string>>()
    for (const a of (crewTeamRows ?? []) as { technician_id: string | null; job_order_id?: string }[]) {
      if (!a.technician_id || !a.job_order_id) continue
      const jobs = crewJobs.get(a.technician_id) ?? new Set<string>()
      jobs.add(a.job_order_id)
      crewJobs.set(a.technician_id, jobs)
    }
    const crewJobCountMap = new Map([...crewJobs].map(([id, jobs]) => [id, jobs.size]))

    const technicians = (heads ?? []).map((h: any) => ({
      id:          h.id,
      full_name:   h.full_name,
      role:        h.role as "head_detailer" | "head_installer",
      source:      "user_account" as const,
      active_jobs: jobCountMap.get(h.id) ?? 0,
    }))

    const crew_members = (crew ?? []).map((c: any) => ({
      id:               c.id,
      full_name:        c.full_name,
      role:             c.role as "detailer" | "installer",
      source:           "technician" as const,
      is_available:     c.is_available as boolean,
      available_days:   (c.available_days as string[]) ?? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
      work_start_time:  (c.work_start_time as string) ?? "08:00:00",
      work_end_time:    (c.work_end_time   as string) ?? "20:00:00",
      availability_override_date: (c.availability_override_date as string | null) ?? null,
      active_jobs:      crewJobCountMap.get(c.id) ?? 0,
      // Kept for older clients: true when on at least one active job.
      on_job:           (crewJobCountMap.get(c.id) ?? 0) > 0,
    }))

    return NextResponse.json({ technicians, crew_members })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
