import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { normalizePhone } from "@/lib/phone"

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

    const trimmed = search.trim()
    if (trimmed) {
      // A Job Order Code lives on job_order, not customer_record — resolve it to
      // the record(s) it points at so Sales can paste a code from a conflict
      // note straight into this search box.
      const { data: jobMatches } = await supabase
        .from("job_order")
        .select("customer_record_id")
        .ilike("job_order_code", `%${trimmed}%`)
        .not("customer_record_id", "is", null)
      const idsFromCode = [...new Set((jobMatches ?? []).map((j) => j.customer_record_id as string))]

      const orClauses = [
        `full_name.ilike.%${trimmed}%`,
        `plate_number.ilike.%${trimmed}%`,
        `contact_number.ilike.%${trimmed}%`,
      ]
      if (idsFromCode.length > 0) {
        orClauses.push(`id.in.(${idsFromCode.join(",")})`)
      }
      query = query.or(orClauses.join(","))
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

    // Canonicalise the phone so the Messenger status flow can match this
    // customer's other vehicles by contact number.
    const normalizedContact = normalizePhone(contact_number) || contact_number

    // Upsert: if a customer_record with this psid already exists (e.g. the
    // customer booked twice), update it instead of hitting the UNIQUE constraint.
    const { data, error } = await supabase
      .from("customer_record")
      .upsert(
        { full_name, contact_number: normalizedContact, email, plate_number, vehicle_unit, psid },
        { onConflict: "psid" }
      )
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
