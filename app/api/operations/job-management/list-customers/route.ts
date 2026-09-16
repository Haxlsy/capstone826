import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRoleCaller } from "@/lib/auth/caller"

const ACTIVE_STATUSES = ["Pending", "Ongoing", "For Rework", "Delayed"]

export async function GET(request: Request) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

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

    const [{ data, error }, { data: busyRows }] = await Promise.all([
      query,
      supabase
        .from("job_order")
        .select("customer_record_id")
        .in("status", ACTIVE_STATUSES)
        .not("customer_record_id", "is", null),
    ])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const busySet = new Set((busyRows ?? []).map((r) => r.customer_record_id as string))
    const customers = (data ?? []).map((c) => ({
      ...c,
      has_active_job: busySet.has(c.id),
    }))

    return NextResponse.json({ customers })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error)?.message ?? String(err) }, { status: 500 })
  }
}
