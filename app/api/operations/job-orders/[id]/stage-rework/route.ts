import { notifyJobStatusChange } from "@/lib/notify-job-status"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { sendPushToUser } from "@/lib/push/send"
import { z } from "zod"
import { getRoleCaller } from "@/lib/auth/caller"

const BodySchema = z.object({
  stage_id:     z.string().uuid(),
  rework_notes: z.string().min(1, "Rework notes are required."),
})

// POST /api/operations/job-orders/[id]/stage-rework
// Body: { stage_id: string, rework_notes: string }
// Operations flags a single stage for rework during inspection.
// The job order status stays "For Inspection" — only the stage status changes.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const { id: jobId } = await params
    const body   = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { stage_id, rework_notes } = parsed.data

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // Guard: job must be For Inspection
    const { data: job } = await admin
      .from("job_order")
      .select("status, customer_name, job_order_code")
      .eq("id", jobId)
      .single()

    if (!job) return NextResponse.json({ error: "Job order not found." }, { status: 404 })
    if (job.status !== "For Inspection") {
      return NextResponse.json(
        { error: "Job order must be in 'For Inspection' status to flag stages for rework." },
        { status: 400 }
      )
    }

    // Bump the active round — the technician's next uploads for this stage
    // get tagged with this round, keeping full history of every past round's
    // media (including the original) instead of overwriting it.
    const { data: stageBefore } = await admin
      .from("job_stage_progress")
      .select("current_rework_round")
      .eq("id", stage_id)
      .single()
    const nextRound = ((stageBefore?.current_rework_round as number | null) ?? 0) + 1

    // Update the stage status and rework notes
    const { error: stageErr } = await admin
      .from("job_stage_progress")
      .update({ status: "for_rework", rework_instructions: rework_notes.trim(), current_rework_round: nextRound })
      .eq("id", stage_id)
      .eq("job_order_id", jobId)

    if (stageErr) return NextResponse.json({ error: stageErr.message }, { status: 500 })

    // Update job status to For Rework so it surfaces correctly in dashboards
    const { error: jobErr } = await admin
      .from("job_order")
      .update({ status: "For Rework" })
      .eq("id", jobId)

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

    await admin.from("job_order_history").insert({
      job_order_id:  jobId,
      status:        "For Rework",
      changed_by_id: user.id,
    })

    // Notify head detailer and head installer
    const { data: team } = await admin
      .from("job_order_team")
      .select("user_account_id, role_in_job")
      .eq("job_order_id", jobId)
      .in("role_in_job", ["head_detailer", "head_installer"])

    const notifRows = (team ?? [])
      .filter((t: { user_account_id: string | null }) => t.user_account_id)
      .map((t: { user_account_id: string }) => ({
        user_id:      t.user_account_id,
        type:         "rework",
        message:      `Job ${job.job_order_code ?? jobId} — Operations flagged a stage for rework. Reason: ${rework_notes.trim()}`,
        job_order_id: jobId,
      }))

    if (notifRows.length > 0) {
      await admin.from("notification").insert(notifRows)
      await Promise.all(
        notifRows.map((n) =>
          sendPushToUser(n.user_id, {
            title: "Stage flagged for rework",
            body: n.message,
            url: `/head-technician/${jobId}`,
          })
        )
      )
    }

    const { data: profile } = await admin
      .from("user_account")
      .select("full_name, role")
      .eq("id", user.id)
      .single()

    if (profile) {
      logAudit({
        user_id:   user.id,
        user_name: profile.full_name,
        role:      profile.role,
        category:  "flag",
        action:    "Flagged stage for rework during inspection",
        target:    job.customer_name ?? jobId,
      })
    }

    await notifyJobStatusChange(admin, {
      jobId,
      jobLabel: job.job_order_code ?? jobId,
      to: "For Rework",
      actorId: user.id,
      message: `Job ${job.job_order_code ?? jobId} — a stage was sent back for rework. Reason: ${rework_notes.trim()}`,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
