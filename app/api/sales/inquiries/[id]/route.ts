import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // When Sales marks the inquiry as resolved, the human handoff is concluded.
    // Close the customer's messenger conversation so the AI resumes handling any
    // new messages (it re-escalates to a fresh inquiry if needed).
    if (status === "resolved") {
      const { data: inq } = await admin
        .from("inquiry")
        .select("psid")
        .eq("id", id)
        .maybeSingle()

      if (inq?.psid) {
        const { error: convErr } = await admin
          .from("messenger_conversation")
          .update({ status: "closed" })
          .eq("psid", inq.psid)

        if (convErr) {
          console.error("[sales/inquiries] messenger_conversation close failed:", convErr.message)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
