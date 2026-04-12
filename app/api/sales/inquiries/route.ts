import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type     = searchParams.get("type")    ?? "all"
    const status   = searchParams.get("status")  ?? "all"

    const supabase = createAdminClient()
    let query = supabase
      .from("inquiry")
      .select(
        `id, messenger_name, psid, inquiry_type, status,
         escalated_at, resolved_at,
         resolver:resolved_by_id(full_name)`
      )
      .order("escalated_at", { ascending: false })

    if (type !== "all")   query = query.eq("inquiry_type", type)
    if (status !== "all") query = query.eq("status", status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inquiries: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
