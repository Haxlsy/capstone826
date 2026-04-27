import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/admin/service-types
// Returns all distinct service_type values currently in use, sorted alphabetically.
export async function GET() {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("service")
      .select("service_type")
      .order("service_type")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const types = [...new Set((data ?? []).map((r) => r.service_type as string).filter(Boolean))].sort()
    return NextResponse.json({ types })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
