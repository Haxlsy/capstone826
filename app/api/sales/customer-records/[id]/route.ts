import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const body = await request.json()
    const { full_name, contact_number, email, plate_number, vehicle_unit } = body

    const updates: Record<string, any> = {}
    if (full_name)            updates.full_name       = full_name.trim()
    if (contact_number)       updates.contact_number  = contact_number.trim()
    if (email !== undefined)  updates.email           = email
    if (plate_number)         updates.plate_number    = plate_number.trim()
    if (vehicle_unit)         updates.vehicle_unit    = vehicle_unit.trim()

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("customer_record")
      .update(updates)
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const caller = await getAuditCaller()
    if (caller) {
      logAuditCall(caller, {
        category: "update",
        action:   "Updated customer record",
        target:   (updates.full_name ?? `record ${id}`) as string,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
