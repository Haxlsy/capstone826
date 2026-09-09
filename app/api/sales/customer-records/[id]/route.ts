import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { normalizePhone } from "@/lib/phone"
import { UpdateCustomerRecordSchema } from "../schema"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const auth = await requireAuditCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const body = await request.json()
    const parsed = UpdateCustomerRecordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed." }, { status: 400 })
    }
    const { full_name, contact_number, email, plate_number, vehicle_unit, psid } = parsed.data

    const updates: Record<string, unknown> = {}
    if (full_name !== undefined)      updates.full_name      = full_name
    // Canonicalise the same way create (POST, ../route.ts) does, so an edited
    // number stays in the same form the Messenger status flow's phone-based
    // customer grouping already relies on.
    if (contact_number !== undefined) updates.contact_number = normalizePhone(contact_number) || contact_number
    if (email !== undefined)          updates.email          = email || null
    if (plate_number !== undefined)   updates.plate_number   = plate_number
    if (vehicle_unit !== undefined)   updates.vehicle_unit   = vehicle_unit

    const supabase = createAdminClient()

    if (updates.plate_number) {
      const { data: plateClash } = await supabase
        .from("customer_record")
        .select("id")
        .eq("plate_number", updates.plate_number)
        .neq("id", id)
        .maybeSingle()
      if (plateClash) {
        return NextResponse.json(
          { error: "That plate number is already on file for another customer record." },
          { status: 409 }
        )
      }
    }

    // Linking a Messenger account (psid) is a deliberate, audited action —
    // Sales does this after verifying identity out-of-band.
    let linkedPsid = false
    if (psid !== undefined) {
      const trimmed = psid ?? ""
      if (trimmed) {
        const { data: clash } = await supabase
          .from("customer_record")
          .select("id")
          .eq("psid", trimmed)
          .neq("id", id)
          .maybeSingle()
        if (clash) {
          return NextResponse.json(
            { error: "That Messenger account is already linked to another customer record." },
            { status: 409 }
          )
        }
        updates.psid = trimmed
      } else {
        updates.psid = null
      }
      linkedPsid = true
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    }

    const { error } = await supabase
      .from("customer_record")
      .update(updates)
      .eq("id", id)

    if (error) {
      // Defensive backstop for a race condition slipping past the pre-checks
      // above (two concurrent edits landing on the same plate/psid).
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That value conflicts with another customer record." },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logAuditCall(caller, {
      category: "update",
      action:   linkedPsid
        ? (updates.psid ? "Linked Messenger account to customer record" : "Unlinked Messenger account from customer record")
        : "Updated customer record",
      target:   (updates.full_name ?? `record ${id}`) as string,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
