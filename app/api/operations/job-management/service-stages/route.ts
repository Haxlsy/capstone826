import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/operations/job-management/service-stages?serviceId=<uuid>
// Returns service_stage rows for a given service, ordered by sequence_order,
// with category info joined from workflow_category.
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
      .select("id, name, sequence_order, workflow_category(id, name, technician_role, display_color)")
      .eq("service_id", serviceId)
      .order("sequence_order")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const stages = (data ?? []).map((s) => {
      const cat = Array.isArray(s.workflow_category)
        ? s.workflow_category[0]
        : s.workflow_category
      return {
        id:             s.id,
        name:           s.name,
        sequence_order: s.sequence_order,
        category_id:    cat?.id    ?? null,
        category_name:  cat?.name  ?? null,
        category_role:  cat?.technician_role ?? null,
        category_color: cat?.display_color ?? null,
      }
    })

    return NextResponse.json({ stages })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
