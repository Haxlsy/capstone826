import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? ""

    const supabase = createAdminClient()
    let query = supabase
      .from("customer_record")
      .select(
        "id, full_name, contact_number, email, plate_number, vehicle_unit, psid, created_at"
      )
      .order("created_at", { ascending: false })

    if (search.trim()) {
      query = query.or(
        `full_name.ilike.%${search.trim()}%,plate_number.ilike.%${search.trim()}%,contact_number.ilike.%${search.trim()}%`
      )
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ records: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { full_name, contact_number, email, plate_number, vehicle_unit, psid } = body

    if (!full_name || !contact_number || !plate_number || !vehicle_unit) {
      return NextResponse.json(
        { error: "full_name, contact_number, plate_number, and vehicle_unit are required." },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("customer_record")
      .insert({ full_name, contact_number, email, plate_number, vehicle_unit, psid })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const caller = await getAuditCaller()
    if (caller) {
      logAuditCall(caller, {
        category: "create",
        action:   "Created customer record",
        target:   full_name,
      })
    }

    return NextResponse.json({ record: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
