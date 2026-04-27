import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type   = searchParams.get("type")   ?? "all"
    const status = searchParams.get("status") ?? "all"

    const supabase = createAdminClient()
    
    // Attempt to fetch all columns first
    let data: any[] | null = null
    let error: any = null

    const result = await supabase
      .from("inquiry")
      .select(
        `id, messenger_name, psid, inquiry_type, status,
         escalated_at, resolved_at,
         extracted_name, extracted_contact, extracted_plate, extracted_vehicle, extracted_email,
         last_message,
         resolver:resolved_by_id(full_name)`
      )
      .order("escalated_at", { ascending: false })

    data = result.data
    error = result.error

    // Fallback if columns are missing (e.g. migration not applied)
    if (error && (error as any).message?.includes("column")) {
      console.warn("⚠️ Falling back to basic inquiry selection due to missing columns.");
      const fallback = await supabase
        .from("inquiry")
        .select(
          `id, messenger_name, psid, inquiry_type, status,
           escalated_at, resolved_at,
           resolver:resolved_by_id(full_name)`
        )
        .order("escalated_at", { ascending: false })
      data  = fallback.data
      error = fallback.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inquiries: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
