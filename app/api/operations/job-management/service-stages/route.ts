import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/operations/job-management/service-stages?serviceId=<uuid>
// Returns service_stage rows for a given service, ordered by sequence_order.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const serviceId = searchParams.get("serviceId")?.trim()

  if (!serviceId) {
    return NextResponse.json({ stages: [] })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("service_stage")
      .select("id, name, category, sequence_order")
      .eq("service_id", serviceId)
      .order("sequence_order")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ stages: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
