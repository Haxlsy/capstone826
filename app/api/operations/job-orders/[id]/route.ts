import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { getJobDetailData } from "@/lib/operations/job-detail-data"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await getJobDetailData(id)
    return NextResponse.json({ job: data.job })
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    console.error("[job-orders detail] failed — error:", msg)
    if (String(msg).includes("Not found.")) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const body = await request.json()
    const {
      status,
      reason,
      head_detailer_id,
      head_installer_id,
      scheduled_at,
    } = body

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // Fetch current job to detect status change
    const { data: current } = await admin
      .from("job_order")
      .select("status, actual_start_at")
      .eq("id", id)
      .single()

    // Guard: "For Release" requires all stages to be done
    if (status === "For Release") {
      const { data: pendingStages } = await admin
        .from("job_stage_progress")
        .select("id")
        .eq("job_order_id", id)
        .neq("status", "done")
      if ((pendingStages ?? []).length > 0) {
        return NextResponse.json(
          { error: "Cannot move to For Release — all stages must be completed first." },
          { status: 400 }
        )
      }
    }

    const updates: Record<string, any> = {}
    if (status !== undefined)      updates.status      = status
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at
    // Set actual_start_at when first moved to Ongoing
    if (status === "Ongoing" && !current?.actual_start_at) {
      updates.actual_start_at = new Date().toISOString()
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await admin
        .from("job_order")
        .update(updates)
        .eq("id", id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update team assignments (upsert by role)
    if (head_detailer_id !== undefined) {
      await admin.from("job_order_team").delete().eq("job_order_id", id).eq("role_in_job", "head_detailer")
      if (head_detailer_id) {
        await admin.from("job_order_team").insert({
          job_order_id:    id,
          user_account_id: head_detailer_id,
          role_in_job:     "head_detailer",
        })
      }
    }
    if (head_installer_id !== undefined) {
      await admin.from("job_order_team").delete().eq("job_order_id", id).eq("role_in_job", "head_installer")
      if (head_installer_id) {
        await admin.from("job_order_team").insert({
          job_order_id:    id,
          user_account_id: head_installer_id,
          role_in_job:     "head_installer",
        })
      }
    }

    // Log status change
    const newStatus = updates.status
    if (newStatus && current?.status !== newStatus) {
      const [{ data: profile }] = await Promise.all([
        admin.from("user_account").select("full_name, role").eq("id", user.id).single(),
        admin.from("job_order_history").insert({
          job_order_id:  id,
          status:        newStatus,
          changed_by_id: user.id,
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        }),
      ])

      if (profile) {
        const isApproval = ["Completed", "Released", "Approved"].includes(newStatus)
        logAudit({
          user_id:   user.id,
          user_name: profile.full_name,
          role:      profile.role,
          category:  isApproval ? "approve" : "update",
          action:    `Updated job status to ${newStatus}`,
          target:    id,
        })
      }
    } else if (head_detailer_id !== undefined || head_installer_id !== undefined || scheduled_at !== undefined) {
      const { data: profile } = await admin.from("user_account").select("full_name, role").eq("id", user.id).single()
      if (profile) {
        logAudit({
          user_id:   user.id,
          user_name: profile.full_name,
          role:      profile.role,
          category:  "update",
          action:    "Updated job assignment",
          target:    id,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

// DELETE /api/operations/job-orders/[id]
// Hard-deletes the job and all related records (cascades to team, stages, history, notifications).
// Only allowed when job status is "Pending".
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    const { data: job } = await admin
      .from("job_order")
      .select("status, customer_name")
      .eq("id", id)
      .single()

    if (!job) return NextResponse.json({ error: "Job order not found." }, { status: 404 })
    if (job.status !== "Pending") {
      return NextResponse.json(
        { error: "Only Pending jobs can be cancelled." },
        { status: 400 }
      )
    }

    const { error: delErr } = await admin
      .from("job_order")
      .delete()
      .eq("id", id)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

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
        category:  "delete",
        action:    `Cancelled and deleted job order for ${job.customer_name}`,
        target:    id,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
