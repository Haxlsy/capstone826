import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuditCaller, getRoleCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { normalizePhone } from "@/lib/phone"
import { UpdateCustomerRecordSchema } from "../schema"
import {
  findActiveJobsByCustomerRecord,
  lockedEditMessage,
  canDeleteCustomerRecord,
  CUSTOMER_RECORD_LOCKED_FIELDS,
} from "@/lib/sales/customer-record-lock"

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

    // A record linked to an active job order can't have its displayed fields
    // changed out from under that job (lib/operations/job-detail-data.ts
    // always prefers the live customer_record over the job's own snapshot).
    // Linking/relinking psid is exempt — it isn't shown on the job at all.
    const touchesLockedField = CUSTOMER_RECORD_LOCKED_FIELDS.some((f) => updates[f] !== undefined)
    if (touchesLockedField) {
      const locked = await findActiveJobsByCustomerRecord(supabase, [id])
      const jobCode = locked.get(id)
      if (jobCode) {
        return NextResponse.json({ error: lockedEditMessage(jobCode) }, { status: 409 })
      }
    }

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

    // Same pattern as the plate check above — contact_number/email had no
    // uniqueness check at all before, so editing a record to an existing
    // phone number or email silently succeeded.
    if (updates.contact_number) {
      const { data: phoneClash } = await supabase
        .from("customer_record")
        .select("id")
        .eq("contact_number", updates.contact_number)
        .neq("id", id)
        .maybeSingle()
      if (phoneClash) {
        return NextResponse.json(
          { error: "That contact number is already on file for another customer record." },
          { status: 409 }
        )
      }
    }

    if (updates.email) {
      const { data: emailClash } = await supabase
        .from("customer_record")
        .select("id")
        .ilike("email", (updates.email as string).replace(/[\\%_]/g, "\\$&"))
        .neq("id", id)
        .maybeSingle()
      if (emailClash) {
        return NextResponse.json(
          { error: "That email is already on file for another customer record." },
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

    const { data: record } = await supabase
      .from("customer_record")
      .select("id, full_name, psid")
      .eq("id", id)
      .maybeSingle()
    if (!record) {
      return NextResponse.json({ error: "Customer record not found." }, { status: 404 })
    }

    // A job order still in service reads this record live
    // (lib/operations/job-detail-data.ts), so it can't go while one is active.
    const locked = await findActiveJobsByCustomerRecord(supabase, [id])
    const verdict = canDeleteCustomerRecord(locked.get(id))
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.reason }, { status: 409 })
    }

    // Past job orders keep their own name/contact/plate snapshot and their
    // customer_record_id is set to NULL by the FK, so history survives.
    const { error } = await supabase.from("customer_record").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // The customer is no longer linked — clear any half-finished verification
    // so the Messenger flow starts clean. Best effort: the delete has already
    // happened, so a failure here must not turn into an error response.
    if (record.psid) {
      await supabase
        .from("messenger_conversation")
        .update({ awaiting_link_verification: false, link_attempts: 0, link_conflict_pending: false })
        .eq("psid", record.psid)
    }

    logAuditCall(caller, {
      category: "delete",
      action:   "Deleted customer record",
      target:   record.full_name as string,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
