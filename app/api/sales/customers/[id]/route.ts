import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuditCaller, getRoleCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { normalizePhone } from "@/lib/phone"
import { UpdateCustomerSchema } from "../../customer-records/schema"
import {
  findActiveJobsByCustomer,
  anyActiveCode,
  nameLockedMessage,
  deleteCustomerBlockedMessage,
} from "@/lib/sales/customer-record-lock"

// A CUSTOMER is the person: name, phone, email and the ONE unique Messenger
// account. Their vehicles are /api/sales/customer-records/[id].

const like = (v: string) => v.replace(/[\\%_]/g, "\\$&")

/** Clears half-finished Messenger verification for an account that just lost its customer link. */
async function resetLinkFlags(supabase: ReturnType<typeof createAdminClient>, psid: string) {
  await supabase
    .from("messenger_conversation")
    .update({ awaiting_link_verification: false, link_attempts: 0, link_conflict_pending: false })
    .eq("psid", psid)
}

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

    const parsed = UpdateCustomerSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed." }, { status: 400 })
    }
    const { full_name, contact_number, email, psid } = parsed.data

    const supabase = createAdminClient()
    const { data: current } = await supabase
      .from("customer")
      .select("id, full_name, contact_number, email, psid")
      .eq("id", id)
      .maybeSingle()
    if (!current) return NextResponse.json({ error: "Customer not found." }, { status: 404 })

    const updates: Record<string, unknown> = {}

    // The name is shown on every job of this customer, so it can't change
    // while any of their vehicles is in service. Phone and email can.
    if (full_name !== undefined && full_name !== current.full_name) {
      const code = anyActiveCode(await findActiveJobsByCustomer(supabase, id))
      if (code) return NextResponse.json({ error: nameLockedMessage(code) }, { status: 409 })
      updates.full_name = full_name
    }

    if (contact_number !== undefined) {
      const phone = normalizePhone(contact_number) || contact_number
      if (phone !== current.contact_number) {
        const { data: clash } = await supabase
          .from("customer").select("id").eq("contact_number", phone).neq("id", id).limit(1)
        if (clash && clash.length > 0) {
          return NextResponse.json({ error: "That contact number is already on file for another customer." }, { status: 409 })
        }
        updates.contact_number = phone
      }
    }

    if (email !== undefined) {
      const next = email || null
      if ((next ?? "").toLowerCase() !== ((current.email as string | null) ?? "").toLowerCase()) {
        if (next) {
          const { data: clash } = await supabase
            .from("customer").select("id").ilike("email", like(next)).neq("id", id).limit(1)
          if (clash && clash.length > 0) {
            return NextResponse.json({ error: "That email is already on file for another customer." }, { status: 409 })
          }
        }
        updates.email = next
      }
    }

    // Linking a Messenger account is a deliberate, audited action — Sales does
    // this after verifying identity out-of-band.
    let psidChange: "linked" | "unlinked" | null = null
    if (psid !== undefined) {
      const next = (psid ?? "").trim() ? (psid ?? "").trim() : null
      if (next !== current.psid) {
        if (next) {
          const { data: clash } = await supabase
            .from("customer").select("id").eq("psid", next).neq("id", id).maybeSingle()
          if (clash) {
            return NextResponse.json({ error: "That Messenger account is already linked to another customer." }, { status: 409 })
          }
        }
        updates.psid = next
        psidChange = next ? "linked" : "unlinked"
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, unchanged: true })
    }

    const { error } = await supabase
      .from("customer")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That value conflicts with another customer." }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Vehicles booked for someone else reference this customer, so relink /
    // unlink follows automatically — nothing to copy. Only the half-finished
    // verification on an account that lost its link needs clearing.
    if (psidChange === "unlinked" && current.psid) await resetLinkFlags(supabase, current.psid as string)

    logAuditCall(caller, {
      category: "update",
      action: psidChange === "linked"
        ? "Linked Messenger account to customer"
        : psidChange === "unlinked"
          ? "Unlinked Messenger account from customer"
          : "Updated customer",
      target: (updates.full_name as string | undefined) ?? (current.full_name as string),
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

/** Hard-deletes a customer and ALL their vehicles. Blocked while any vehicle is in service. */
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
    const { data: customer } = await supabase
      .from("customer")
      .select("id, full_name, psid")
      .eq("id", id)
      .maybeSingle()
    if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 })

    const code = anyActiveCode(await findActiveJobsByCustomer(supabase, id))
    if (code) return NextResponse.json({ error: deleteCustomerBlockedMessage(code) }, { status: 409 })

    // Vehicles cascade; job orders keep their own snapshot (their vehicle link
    // is set to NULL by the FK), so history survives.
    const { error } = await supabase.from("customer").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (customer.psid) await resetLinkFlags(supabase, customer.psid as string)

    logAuditCall(caller, { category: "delete", action: "Deleted customer", target: customer.full_name as string })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
