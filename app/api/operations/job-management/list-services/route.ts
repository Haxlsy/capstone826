import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("service")
      .select("id, name, service_type, description, estimated_duration_mins")
      .eq("is_archived", false)
      .order("name")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ services: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
