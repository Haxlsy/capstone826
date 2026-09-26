import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuditCaller, getRoleCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { resumeBotAfterHandoff } from "@/lib/messenger/handoff"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const roleAuth = await getRoleCaller(["sales"])
    if ("error" in roleAuth) return roleAuth.error

    const body = await request.json()
    const { status } = body

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()
    const updates: Record<string, unknown> = {}

    if (status === "resolved" || status === "recorded") {
      updates.status         = status
      updates.resolved_at    = new Date().toISOString()
      updates.resolved_by_id = user.id
    } else if (status === "open") {
      updates.status = "open"
    } else if (status !== undefined) {
      return NextResponse.json({ error: "status must be 'open', 'resolved', or 'recorded'." }, { status: 400 })
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    }

    const { error } = await admin
      .from("inquiry")
      .update(updates)
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // When Sales records or resolves the inquiry, the human handoff is
    // concluded. `resumeBotAfterHandoff` closes the customer's messenger
    // conversation so the AI resumes handling new messages (it re-escalates to a
    // fresh inquiry if needed) and re-sends the quick-reply menu, so the customer
    // does not have to start the chat again to get the buttons back.
    if (status === "resolved" || status === "recorded") {
      const { data: inq } = await admin
        .from("inquiry")
        .select("psid, extracted_name")
        .eq("id", id)
        .maybeSingle()

      let customerName: string | null = inq?.extracted_name ?? null
      if (!customerName && inq?.psid) {
        const { data: rec } = await admin
          .from("customer")
          .select("full_name")
          .eq("psid", inq.psid)
          .maybeSingle()
        customerName = rec?.full_name ?? null
      }

      const caller = await getAuditCaller()
      if (caller) {
        logAuditCall(caller, {
          category: "approve",
          action:   status === "resolved" ? "Resolved Messenger inquiry" : "Recorded Messenger inquiry",
          target:   customerName ?? `inquiry ${id}`,
        })
      }

      if (inq?.psid) {
        await resumeBotAfterHandoff(inq.psid)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
