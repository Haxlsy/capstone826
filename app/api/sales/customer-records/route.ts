import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuditCaller, getRoleCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { normalizePhone, isPlausibleMobile } from "@/lib/phone"
import { CreateCustomerRecordSchema } from "./schema"
import { findActiveJobsByCustomerRecord } from "@/lib/sales/customer-record-lock"
import { dateAddedBounds } from "@/lib/sales/customer-records-filter"
import { decideRecordCustomer } from "@/lib/sales/record-customer"

type One<T> = T | T[] | null | undefined
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

interface VehicleRow {
  id: string
  plate_number: string
  vehicle_unit: string
  created_at: string
  booked_by_customer_id: string | null
  booked_by: One<{ full_name: string | null; psid: string | null }>
}

/**
 * GET — customers (the people) with their vehicles nested, newest first, paged
 * BY CUSTOMER so one customer's vehicles are never split across pages.
 */
export async function GET(request: Request) {
  try {
    const authCheck = await getRoleCaller(["sales"])
    if ("error" in authCheck) return authCheck.error

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? ""
    const limit  = Math.min(Math.max(parseInt(searchParams.get("limit")  ?? "20", 10) || 20, 1), 100)
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0",  10) || 0, 0)
    // Date added (Asia/Manila days), both bounds optional — the customer's created_at.
    const bounds = dateAddedBounds(searchParams.get("from"), searchParams.get("to"))

    const supabase = createAdminClient()

    // Search matches a customer by name/phone, by any of their vehicles' plates,
    // or by a Job Order ID (so Sales can paste a code from a conflict note).
    let idFilter: string[] | null = null
    const trimmed = search.trim()
    if (trimmed) {
      const [byCustomer, byPlate, jobMatches] = await Promise.all([
        supabase.from("customer").select("id")
          .or(`full_name.ilike.%${trimmed}%,contact_number.ilike.%${trimmed}%`).limit(500),
        supabase.from("customer_record").select("customer_id")
          .ilike("plate_number", `%${trimmed}%`).limit(500),
        supabase.from("job_order").select("customer_record_id")
          .ilike("job_order_code", `%${trimmed}%`)
          .not("customer_record_id", "is", null).limit(200),
      ])
      const ids = new Set<string>()
      for (const r of byCustomer.data ?? []) ids.add(r.id as string)
      for (const r of byPlate.data ?? []) if (r.customer_id) ids.add(r.customer_id as string)
      const jobVehicleIds = [...new Set((jobMatches.data ?? []).map((j) => j.customer_record_id as string))]
      if (jobVehicleIds.length > 0) {
        const { data: viaJob } = await supabase.from("customer_record").select("customer_id").in("id", jobVehicleIds)
        for (const r of viaJob ?? []) if (r.customer_id) ids.add(r.customer_id as string)
      }
      idFilter = [...ids]
      if (idFilter.length === 0) return NextResponse.json({ customers: [], hasMore: false })
    }

    let query = supabase
      .from("customer")
      .select(
        `id, full_name, contact_number, email, psid, created_at,
         vehicles:customer_record!customer_id(
           id, plate_number, vehicle_unit, created_at, booked_by_customer_id,
           booked_by:customer!booked_by_customer_id(full_name, psid)
         )`,
      )
      .order("created_at", { ascending: false })

    if (bounds.gte) query = query.gte("created_at", bounds.gte)
    if (bounds.lt)  query = query.lt("created_at", bounds.lt)
    if (idFilter)   query = query.in("id", idFilter)

    const { data, error } = await query.range(offset, offset + limit - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // A vehicle in service can't be edited or deleted — flag it here so the UI
    // can disable those per vehicle instead of only failing after the fact.
    const rows = (data ?? []) as unknown as (Record<string, unknown> & { id: string; psid: string | null; vehicles: VehicleRow[] })[]
    const vehicleIds = rows.flatMap((c) => (c.vehicles ?? []).map((v) => v.id))
    const locked = await findActiveJobsByCustomerRecord(supabase, vehicleIds)

    const customers = rows.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      contact_number: c.contact_number,
      email: c.email,
      psid: c.psid,
      created_at: c.created_at,
      vehicles: [...(c.vehicles ?? [])]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((v) => {
          const booker = first(v.booked_by)
          return {
            id: v.id,
            plate_number: v.plate_number,
            vehicle_unit: v.vehicle_unit,
            created_at: v.created_at,
            booked_by_name: booker?.full_name ?? null,
            active_job_order_code: locked.get(v.id) ?? null,
            // How job updates reach this vehicle: its owner's Messenger, else whoever booked it.
            messenger_via: c.psid ? "own" : booker?.psid ? "booked_by" : null,
          }
        }),
    }))

    return NextResponse.json({ customers, hasMore: rows.length === limit })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

const like = (v: string) => v.replace(/[\\%_]/g, "\\$&")

/**
 * POST — record a booking: find or create the customer, then add the vehicle.
 * See lib/sales/record-customer.ts for which customer a booking belongs to.
 */
export async function POST(request: Request) {
  try {
    const authCheck = await getRoleCaller(["sales"])
    if ("error" in authCheck) return authCheck.error

    const auth = await requireAuditCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const body = await request.json()
    const parsed = CreateCustomerRecordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed." }, { status: 400 })
    }
    const { full_name, contact_number, plate_number, vehicle_unit, psid, for_someone_else } = parsed.data
    const email = parsed.data.email || null
    const supabase = createAdminClient()
    const phone = normalizePhone(contact_number) || contact_number
    const psidValue = psid?.trim() || null

    const { data: customerByPsid } = psidValue
      ? await supabase.from("customer").select("id").eq("psid", psidValue).maybeSingle()
      : { data: null }

    // ── The plate is already on file ────────────────────────────────────────
    const { data: existingVehicle } = await supabase
      .from("customer_record")
      .select("id, customer_id, customer:customer!customer_id(id, psid)")
      .ilike("plate_number", like(plate_number))
      .maybeSingle()

    if (existingVehicle) {
      const owner = first(existingVehicle.customer as One<{ id: string; psid: string | null }>)
      // The same Messenger account, or an unlinked customer: this booking is a
      // correction / the first Messenger link for that customer.
      const sameOwner = !psidValue || !owner?.psid || owner.psid === psidValue
      if (!sameOwner) {
        return NextResponse.json(
          { error: "That plate number is already on file for another customer record." },
          { status: 409 },
        )
      }
      if (psidValue && owner && !owner.psid) {
        if (customerByPsid && customerByPsid.id !== owner.id) {
          return NextResponse.json(
            { error: "That Messenger account is already linked to another customer." },
            { status: 409 },
          )
        }
        await supabase.from("customer").update({ psid: psidValue }).eq("id", owner.id)
      }
      const { data: updated, error: updErr } = await supabase
        .from("customer_record")
        .update({ vehicle_unit })
        .eq("id", existingVehicle.id)
        .select()
        .single()
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
      logAuditCall(caller, { category: "update", action: "Updated customer record", target: full_name })
      return NextResponse.json({ record: updated, customer_id: existingVehicle.customer_id }, { status: 200 })
    }

    // ── Which customer? ─────────────────────────────────────────────────────
    let sameNamePhoneCustomer: { id: string } | null = null
    if (!psidValue && isPlausibleMobile(phone)) {
      const { data: byPhone } = await supabase
        .from("customer")
        .select("id, full_name")
        .eq("contact_number", phone)
      sameNamePhoneCustomer =
        (byPhone ?? []).find((c) => (c.full_name as string).trim().toLowerCase() === full_name.trim().toLowerCase()) ?? null
    }

    const decision = decideRecordCustomer({
      psid: psidValue,
      forSomeoneElse: Boolean(for_someone_else),
      customerByPsid,
      sameNamePhoneCustomer,
    })

    let customerId: string
    let bookedBy: string | null = null
    if (decision.kind === "use_existing") {
      customerId = decision.customerId
    } else {
      const { data: created, error: custErr } = await supabase
        .from("customer")
        .insert({ full_name, contact_number: phone, email, psid: decision.psid })
        .select("id")
        .single()
      if (custErr) {
        if (custErr.code === "23505") {
          return NextResponse.json({ error: "That Messenger account is already linked to another customer." }, { status: 409 })
        }
        return NextResponse.json({ error: custErr.message }, { status: 500 })
      }
      customerId = created.id as string
      bookedBy = decision.bookedByCustomerId
      logAuditCall(caller, { category: "create", action: "Created customer", target: full_name })
    }

    const { data: vehicle, error: vehErr } = await supabase
      .from("customer_record")
      .insert({
        customer_id: customerId,
        plate_number,
        vehicle_unit,
        ...(bookedBy ? { booked_by_customer_id: bookedBy } : {}),
      })
      .select()
      .single()
    if (vehErr) {
      if (vehErr.code === "23505") {
        return NextResponse.json({ error: "That plate number is already on file for another customer record." }, { status: 409 })
      }
      return NextResponse.json({ error: vehErr.message }, { status: 500 })
    }

    logAuditCall(caller, { category: "create", action: "Created customer record", target: full_name })
    return NextResponse.json({ record: vehicle, customer_id: customerId }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
