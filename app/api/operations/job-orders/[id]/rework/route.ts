import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { sendPushToUser } from "@/lib/push/send"
import { getRoleCaller } from "@/lib/auth/caller"

// POST /api/operations/job-orders/[id]/rework
// Body: { stage_ids: string[], rework_instructions: string }
// Operations flags one or more stages for rework and notifies the head tech.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const { id: jobId } = await params
    const body = await request.json()
    const { stage_ids, rework_instructions } = body as {
      stage_ids?: string[]
      rework_instructions?: string
    }

    if (!stage_ids?.length) {
      return NextResponse.json({ error: "stage_ids is required." }, { status: 400 })
    }
    if (!rework_instructions?.trim()) {
      return NextResponse.json({ error: "rework_instructions is required." }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // Mark selected stages as for_rework
    const { error: stageErr } = await admin
      .from("job_stage_progress")
      .update({ status: "for_rework", rework_instructions: rework_instructions.trim() })
      .in("id", stage_ids)
      .eq("job_order_id", jobId)

    if (stageErr) return NextResponse.json({ error: stageErr.message }, { status: 500 })

    // Update job status to For Rework
    const { error: jobErr } = await admin
      .from("job_order")
      .update({ status: "For Rework" })
      .eq("id", jobId)

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

    // Log status change
    await admin.from("job_order_history").insert({
      job_order_id:  jobId,
      status:        "For Rework",
      changed_by_id: user.id,
    })

    // Find the head_detailer and head_installer assigned to this job
    const { data: team } = await admin
      .from("job_order_team")
      .select("user_account_id, role_in_job")
      .eq("job_order_id", jobId)
      .in("role_in_job", ["head_detailer", "head_installer"])

    // Send notifications to both head techs
    const notifRows = (team ?? [])
      .filter((t: any) => t.user_account_id)
      .map((t: any) => ({
        user_id:      t.user_account_id,
        type:         "rework",
        message:      `Operations has flagged stage(s) for rework on job order. Instructions: ${rework_instructions.trim()}`,
        job_order_id: jobId,
      }))

    if (notifRows.length > 0) {
      await admin.from("notification").insert(notifRows)
      await Promise.all(
        notifRows.map((n) =>
          sendPushToUser(n.user_id, {
            title: "Stage(s) flagged for rework",
            body: n.message,
            url: `/head-technician/${jobId}`,
          })
        )
      )
    }

    const { data: profile } = await admin.from("user_account").select("full_name, role").eq("id", user.id).single()
    const { data: jobRow } = await admin.from("job_order").select("customer_name").eq("id", jobId).single()
    if (profile) {
      logAudit({
        user_id:   user.id,
        user_name: profile.full_name,
        role:      profile.role,
        category:  "flag",
        action:    "Flagged job for rework",
        target:    jobRow?.customer_name ?? jobId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
