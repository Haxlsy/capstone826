import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRoleCaller } from "@/lib/auth/caller"
import { recipientFromVehicle } from "@/lib/messenger/recipient"

const ACTIVE_STATUSES = ["Pending", "Ongoing", "For Rework", "Delayed"]

type One<T> = T | T[] | null | undefined
const first = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

// One row per VEHICLE with its owner's details, so Add Job Order can pick a
// vehicle, auto-fetch by plate / phone / email, and group a customer's
// vehicles by `customer_id`.
export async function GET(request: Request) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get("search") ?? "").trim().toLowerCase()

    const supabase = createAdminClient()

    const [{ data, error }, { data: busyRows }] = await Promise.all([
      supabase
        .from("customer_record")
        .select(
          `id, customer_id, plate_number, vehicle_unit,
           owner:customer!customer_id(full_name, contact_number, email, psid),
           booked_by:customer!booked_by_customer_id(psid)`,
        ),
      supabase
        .from("job_order")
        .select("customer_record_id")
        .in("status", ACTIVE_STATUSES)
        .not("customer_record_id", "is", null),
    ])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const busySet = new Set((busyRows ?? []).map((r) => r.customer_record_id as string))
    let customers = (data ?? []).map((v) => {
      const owner = first(v.owner as One<{ full_name: string; contact_number: string | null; email: string | null; psid: string | null }>)
      return {
        id: v.id as string,
        customer_id: v.customer_id as string,
        full_name: owner?.full_name ?? "",
        contact_number: owner?.contact_number ?? "",
        email: owner?.email ?? null,
        plate_number: v.plate_number as string,
        vehicle_unit: v.vehicle_unit as string | null,
        has_active_job: busySet.has(v.id as string),
        // How job updates reach this vehicle's customer on Messenger.
        messenger_via: recipientFromVehicle(v as never).via,
      }
    })

    if (search) {
      customers = customers.filter(
        (c) => c.full_name.toLowerCase().includes(search) || c.plate_number.toLowerCase().includes(search),
      )
    }
    customers.sort((a, b) => a.full_name.localeCompare(b.full_name) || a.plate_number.localeCompare(b.plate_number))

    return NextResponse.json({ customers })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error)?.message ?? String(err) }, { status: 500 })
  }
}
