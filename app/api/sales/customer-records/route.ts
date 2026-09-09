import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { normalizePhone } from "@/lib/phone"
import { CreateCustomerRecordSchema } from "./schema"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? ""
    const limit  = Math.min(Math.max(parseInt(searchParams.get("limit")  ?? "20", 10) || 20, 1), 100)
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0",  10) || 0, 0)

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

    const { data, error } = await query.range(offset, offset + limit - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ records: data ?? [], hasMore: (data ?? []).length === limit })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuditCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const body = await request.json()
    const parsed = CreateCustomerRecordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed." }, { status: 400 })
    }
    const { full_name, contact_number, plate_number, vehicle_unit, psid } = parsed.data
    const email = parsed.data.email || null

    const supabase = createAdminClient()

    // Canonicalise the phone so the Messenger status flow can match this
    // customer's other vehicles by contact number.
    const normalizedContact = normalizePhone(contact_number) || contact_number

    // plate_number is the true per-vehicle key (globally UNIQUE) — a customer
    // with two vehicles is two rows sharing a phone number, never one row
    // upserted on psid. Upserting on psid instead (the old behaviour) always
    // overwrote vehicle #1 with vehicle #2's details, since a returning
    // customer's second booking carries the SAME psid as their first.
    const { data: existingByPlate } = await supabase
      .from("customer_record")
      .select("id")
      .eq("plate_number", plate_number)
      .maybeSingle()

    let data, error, isNewRecord: boolean

    if (existingByPlate) {
      // Same vehicle on file already (e.g. a correction) — update it in place.
      ;({ data, error } = await supabase
        .from("customer_record")
        .update({ full_name, contact_number: normalizedContact, email, vehicle_unit, psid })
        .eq("id", existingByPlate.id)
        .select()
        .single())
      isNewRecord = false
    } else {
      // A genuinely new vehicle. If this psid already belongs to a different
      // row (the customer's earlier vehicle), it can't be set here too — psid
      // is also UNIQUE. Leave it null; resolveOwnVehicleStatus already finds
      // this row via the shared (normalized) phone number instead.
      let psidForInsert = psid ?? null
      if (psidForInsert) {
        const { data: existingByPsid } = await supabase
          .from("customer_record")
          .select("id")
          .eq("psid", psidForInsert)
          .maybeSingle()
        if (existingByPsid) psidForInsert = null
      }
      ;({ data, error } = await supabase
        .from("customer_record")
        .insert({ full_name, contact_number: normalizedContact, email, plate_number, vehicle_unit, psid: psidForInsert })
        .select()
        .single())
      isNewRecord = true
    }

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That value conflicts with another customer record." },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logAuditCall(caller, {
      category: isNewRecord ? "create" : "update",
      action:   isNewRecord ? "Created customer record" : "Updated customer record",
      target:   full_name,
    })

    return NextResponse.json({ record: data }, { status: isNewRecord ? 201 : 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
