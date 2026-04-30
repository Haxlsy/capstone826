import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? ""

    const supabase = createAdminClient()
    let query = supabase
      .from("customer_record")
      .select("id, full_name, contact_number, plate_number, vehicle_unit, email, psid")
      .order("full_name")

    if (search.trim()) {
      query = query.or(
        `full_name.ilike.%${search.trim()}%,plate_number.ilike.%${search.trim()}%`
      )
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Determine which customer_records have an active job (Pending / Ongoing / For Rework)
    const { data: activeJobs } = await supabase
      .from("job_order")
      .select("customer_record_id")
      .in("status", ["Pending", "Ongoing", "For Rework"])
      .not("customer_record_id", "is", null)

    const activeSet = new Set((activeJobs ?? []).map((j) => j.customer_record_id as string))

    const customers = (data ?? []).map((c) => ({
      ...c,
      is_in_service: activeSet.has(c.id),
    }))

    return NextResponse.json({ customers })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
