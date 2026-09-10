import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { sendPushToUser } from "@/lib/push/send"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("concern")
      .select(
        `id, title, description, status, response_note,
         submitted_at, resolved_at,
         job:job_order_id(id, status),
         submitter:submitted_by_id(id, full_name, role),
         resolver:resolved_by_id(full_name),
         media:concern_media(id, file_url, media_type)`
      )
      .eq("id", id)
      .single()

    if (error || !data) return NextResponse.json({ error: "Not found." }, { status: 404 })
    return NextResponse.json({ concern: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const body = await request.json()
    const { status, response_note } = body

    if (!status) return NextResponse.json({ error: "status is required." }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // Fetch concern details before update (for notification)
    let submitterId: string | null = null
    let concernJobId: string | null = null
    let concernCustomerName: string | null = null
    // A queued offline resolution can replay against a concern someone else
    // already resolved online in the meantime — treat that as an idempotent
    // no-op (see docs/plan/operations-offline-mode-plan.md) rather than
    // overwriting who actually resolved it or re-notifying the submitter.
    let alreadyResolved = false
    if (status === "Resolved") {
      const { data: concernRow } = await admin
        .from("concern")
        .select("status, submitted_by_id, job_order_id")
        .eq("id", id)
        .single<{ status: string; submitted_by_id: string | null; job_order_id: string | null }>()
      alreadyResolved = concernRow?.status === "Resolved"
      submitterId = concernRow?.submitted_by_id ?? null
      concernJobId = concernRow?.job_order_id ?? null
      if (concernJobId) {
        const { data: jobRow } = await admin
          .from("job_order")
          .select("customer_name")
          .eq("id", concernJobId)
          .single()
        concernCustomerName = (jobRow as any)?.customer_name ?? null
      }
    }

    const updates: Record<string, any> = { status }
    if (status === "Resolved" && !alreadyResolved) {
      updates.resolved_by_id = user.id
      updates.resolved_at    = new Date().toISOString()
      updates.response_note  = response_note ?? null
    }

    const { error } = await admin
      .from("concern")
      .update(updates)
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const caller = await getAuditCaller()
    if (caller && status === "Resolved") {
      logAuditCall(caller, {
        category: "approve",
        action:   "Resolved concern",
        target:   concernCustomerName ?? `concern ${id}`,
      })
    }

    // ── Notify submitting head tech ─────────────────────────────────────────
    if (status === "Resolved" && !alreadyResolved && submitterId) {
      try {
        await admin.from("notification").insert({
          user_id:      submitterId,
          type:         "concern_resolved",
          message:      response_note ?? "Your concern has been resolved.",
          job_order_id: concernJobId,
          is_read:      false,
        })
        await sendPushToUser(submitterId, {
          title: "Concern resolved",
          body:  response_note ?? "Your concern has been resolved.",
          url:   concernJobId ? `/head-technician/${concernJobId}` : "/head-technician",
        })
      } catch (notifErr) {
        console.error("[job-concerns] resolve notification failed:", notifErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
