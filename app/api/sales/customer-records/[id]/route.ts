import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuditCaller, getRoleCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { UpdateVehicleSchema } from "../schema"
import {
  findActiveJobsByCustomerRecord,
  vehicleLockedMessage,
  deleteVehicleBlockedMessage,
} from "@/lib/sales/customer-record-lock"

// This route is a VEHICLE (a `customer_record` row: plate + vehicle unit).
// The person — name, phone, email, Messenger account — is edited through
// /api/sales/customers/[id].

const like = (v: string) => v.replace(/[\\%_]/g, "\\$&")

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const roleAuth = await getRoleCaller(["sales"])
    if ("error" in roleAuth) return roleAuth.error

    const auth = await requireAuditCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const parsed = UpdateVehicleSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed." }, { status: 400 })
    }
    const updates: Record<string, unknown> = {}
    if (parsed.data.plate_number !== undefined) updates.plate_number = parsed.data.plate_number
    if (parsed.data.vehicle_unit !== undefined) updates.vehicle_unit = parsed.data.vehicle_unit
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    }

    const supabase = createAdminClient()

    // A vehicle in service can't have its displayed fields changed under the job.
    const locked = await findActiveJobsByCustomerRecord(supabase, [id])
    const jobCode = locked.get(id)
    if (jobCode) {
      return NextResponse.json({ error: vehicleLockedMessage(jobCode) }, { status: 409 })
    }

    if (updates.plate_number) {
      const { data: clash } = await supabase
        .from("customer_record")
        .select("id")
        .ilike("plate_number", like(updates.plate_number as string))
        .neq("id", id)
        .maybeSingle()
      if (clash) {
        return NextResponse.json(
          { error: "That plate number is already on file for another customer record." },
          { status: 409 }
        )
      }
    }

    const { data: vehicle } = await supabase
      .from("customer_record")
      .select("id, customer:customer!customer_id(full_name)")
      .eq("id", id)
      .maybeSingle()
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 })

    const { error } = await supabase.from("customer_record").update(updates).eq("id", id)
    if (error) {
      // Backstop for a race slipping past the pre-check above.
      if (error.code === "23505") {
        return NextResponse.json({ error: "That value conflicts with another customer record." }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const owner = (Array.isArray(vehicle.customer) ? vehicle.customer[0] : vehicle.customer) as { full_name?: string } | null
    await logAuditCall(caller, {
      category: "update",
      action:   "Updated vehicle",
      target:   owner?.full_name ?? `vehicle ${id}`,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

/** Hard-deletes ONE vehicle. The customer — and their Messenger link — are untouched. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const roleAuth = await getRoleCaller(["sales"])
    if ("error" in roleAuth) return roleAuth.error

    const auth = await requireAuditCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const supabase = createAdminClient()

    const { data: vehicle } = await supabase
      .from("customer_record")
      .select("id, plate_number, customer:customer!customer_id(full_name)")
      .eq("id", id)
      .maybeSingle()
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found." }, { status: 404 })
    }

    const locked = await findActiveJobsByCustomerRecord(supabase, [id])
    const code = locked.get(id)
    if (code) {
      return NextResponse.json({ error: deleteVehicleBlockedMessage(code) }, { status: 409 })
    }

    // Past job orders keep their own snapshot and their customer_record_id is
    // set to NULL by the FK, so history survives.
    const { error } = await supabase.from("customer_record").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const owner = (Array.isArray(vehicle.customer) ? vehicle.customer[0] : vehicle.customer) as { full_name?: string } | null
    await logAuditCall(caller, {
      category: "delete",
      action:   "Deleted vehicle",
      target:   `${owner?.full_name ?? "customer"} — ${vehicle.plate_number as string}`,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
