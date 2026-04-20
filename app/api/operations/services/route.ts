import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/operations/services
// Returns paginated service list with stage counts, supporting search and status filter.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search      = searchParams.get("search")?.trim() ?? ""
    const status      = searchParams.get("status") ?? "all"
    const page        = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10))
    const pageSize    = Math.max(1, parseInt(searchParams.get("limit") ?? "15", 10))
    const durationMin = searchParams.get("durationMin") ? parseInt(searchParams.get("durationMin")!, 10) : null
    const durationMax = searchParams.get("durationMax") ? parseInt(searchParams.get("durationMax")!, 10) : null

    const supabase = createAdminClient()

    // Stage counts per service
    const { data: stageCounts } = await supabase
      .from("service_stage")
      .select("service_id")

    const countMap: Record<string, number> = {}
    for (const row of stageCounts ?? []) {
      countMap[row.service_id] = (countMap[row.service_id] ?? 0) + 1
    }

    // Base query
    let query = supabase
      .from("service")
      .select("id, name, description, estimated_duration_mins, is_archived, created_at", { count: "exact" })
      .order("created_at", { ascending: false })

    if (search) query = query.ilike("name", `%${search}%`)
    if (status === "active")   query = query.eq("is_archived", false)
    if (status === "archived") query = query.eq("is_archived", true)
    if (durationMin !== null) query = query.gte("estimated_duration_mins", durationMin)
    if (durationMax !== null) query = query.lte("estimated_duration_mins", durationMax)

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const services = (data ?? []).map((s) => ({
      id:                     s.id,
      name:                   s.name,
      description:            s.description ?? null,
      estimated_duration_mins: s.estimated_duration_mins ?? null,
      is_archived:            s.is_archived,
      stage_count:            countMap[s.id] ?? 0,
    }))

    return NextResponse.json({ services, total: count ?? 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
