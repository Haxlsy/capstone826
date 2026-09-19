import { notifyJobStatusChange } from "@/lib/notify-job-status"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { getJobDetailData } from "@/lib/operations/job-detail-data"
import { totalStageDurationMins, computeExpectedCompletion } from "@/lib/job-estimates"
import { sendPushToUser } from "@/lib/push/send"
import { sendMessengerText } from "@/lib/messenger/graph"
import { buildReleaseMessage, buildCompletionMessage, getOperatingHoursText } from "@/lib/messenger/status-update"
import { getRoleCaller } from "@/lib/auth/caller"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Also read by Sales' own job order detail view
    // (components/dashboard/SalesDashboard/SalesJobDetail.tsx) — a
    // deliberate, narrow read-only exception, not a blanket cross-role grant.
    const auth = await getRoleCaller(["operations", "sales"])
    if ("error" in auth) return auth.error

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
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

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

    // "Delayed" is fully computed now (lib/job-delay.ts) — no one, including
    // a direct API call bypassing the status picker's own UI-only guard,
    // sets it manually anymore.
    if (status === "Delayed") {
      return NextResponse.json(
        { error: "Delayed is now automatic and can't be set manually." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Fetch current job to detect status change
    const { data: current } = await admin
      .from("job_order")
      .select("status, actual_start_at, customer_name, plate_number, job_order_code")
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

    // Guard: Scheduled Start is only editable while the job hasn't started
    // yet — once it's Ongoing (or beyond), actual_start_at already anchors
    // the estimate and moving the schedule retroactively would be misleading.
    if (scheduled_at !== undefined && current?.status !== "Pending") {
      return NextResponse.json(
        { error: "Scheduled Start can only be edited while the job is Pending." },
        { status: 400 }
      )
    }

    const updates: Record<string, any> = {}
    if (status !== undefined)      updates.status      = status
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at
    // Set actual_start_at when first moved to Ongoing
    if (status === "Ongoing" && !current?.actual_start_at) {
      updates.actual_start_at = new Date().toISOString()
    }

    // Editing Scheduled Start moves Est. Completion with it — recompute and
    // persist the same way lib/operations/job-detail-data.ts derives it for
    // display, so every other surface (dashboards, delay checks) that reads
    // the stored column stays in sync instead of only the detail page.
    if (scheduled_at !== undefined) {
      const { data: stages } = await admin
        .from("job_stage_progress")
        .select("stage_duration_mins, service_stage_id")
        .eq("job_order_id", id)
      const ssIds = [...new Set((stages ?? []).map((s) => s.service_stage_id).filter(Boolean) as string[])]
      let ssMap = new Map<string, { stage_duration_mins: number }>()
      if (ssIds.length > 0) {
        const { data: ssRows } = await admin
          .from("service_stage")
          .select("id, stage_duration_mins")
          .in("id", ssIds)
        ssMap = new Map((ssRows ?? []).map((r) => [r.id, r]))
      }
      const totalDurationMins = totalStageDurationMins(stages ?? [], ssMap)
      const { expected } = computeExpectedCompletion({
        scheduled_at,
        actual_start_at: current?.actual_start_at ?? null,
        totalDurationMins,
      })
      updates.expected_completion_at = expected
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await admin
        .from("job_order")
        .update(updates)
        .eq("id", id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update team assignments (upsert by role) — capture the previous
    // assignees first so we only notify technicians who are newly assigned,
    // not ones re-saved unchanged.
    let prevHeadDetailer: string | null = null
    let prevHeadInstaller: string | null = null
    if (head_detailer_id !== undefined || head_installer_id !== undefined) {
      const { data: currentTeam } = await admin
        .from("job_order_team")
        .select("user_account_id, role_in_job")
        .eq("job_order_id", id)
        .in("role_in_job", ["head_detailer", "head_installer"])
      prevHeadDetailer = currentTeam?.find((t) => t.role_in_job === "head_detailer")?.user_account_id ?? null
      prevHeadInstaller = currentTeam?.find((t) => t.role_in_job === "head_installer")?.user_account_id ?? null
    }

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

    // ── Notify newly assigned head technicians (skip if unchanged) ────────────
    try {
      const jobLabel = current?.job_order_code ?? id
      const reassignNotifs: Record<string, unknown>[] = []
      if (head_detailer_id !== undefined && head_detailer_id && head_detailer_id !== prevHeadDetailer) {
        reassignNotifs.push({
          user_id: head_detailer_id,
          type: "job_assigned",
          message: `You've been assigned as Head Detailer for job ${jobLabel}.`,
          job_order_id: id,
        })
      }
      if (head_installer_id !== undefined && head_installer_id && head_installer_id !== prevHeadInstaller) {
        reassignNotifs.push({
          user_id: head_installer_id,
          type: "job_assigned",
          message: `You've been assigned as Head Installer for job ${jobLabel}.`,
          job_order_id: id,
        })
      }
      if (reassignNotifs.length > 0) {
        await admin.from("notification").insert(reassignNotifs)
        await Promise.all(
          reassignNotifs.map((n) =>
            sendPushToUser(n.user_id as string, {
              title: "New job assigned",
              body: n.message as string,
              url: `/head-technician/${id}`,
            })
          )
        )
      }
    } catch (notifErr) {
      console.error("[job-orders PATCH] notification fan-out failed:", notifErr)
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
          target:    current?.customer_name ?? id,
        })
      }

      // Tell the rest of the Operations team (not the person who did it).
      await notifyJobStatusChange(admin, {
        jobId:    id,
        jobLabel: current?.job_order_code ?? current?.customer_name ?? id,
        from:     current?.status,
        to:       newStatus,
        actorId:  user.id,
      })

      // ── Customer-facing status messages ────────────────────────────────────
      // "For Release" → ready-for-pickup, "Released" → thank-you. Wrapped so a
      // messaging failure never breaks the status-update response — same
      // philosophy as the head-technician stage-update auto-send.
      if (newStatus === "For Release" || newStatus === "Released") {
        try {
          const { data: custRow } = await admin
            .from("job_order")
            .select(
              `plate_number, vehicle_unit, customer_name,
               customer:customer_record_id(psid, full_name, vehicle_unit, plate_number)`
            )
            .eq("id", id)
            .single()
          const cr = custRow as any
          const psid = cr?.customer?.psid ?? null

          if (psid && process.env.META_PAGE_ACCESS_TOKEN) {
            const customerName = cr?.customer?.full_name ?? cr?.customer_name ?? null
            const vehicleUnit  = cr?.customer?.vehicle_unit ?? cr?.vehicle_unit ?? null
            const plate        = cr?.customer?.plate_number ?? cr?.plate_number ?? null

            const message = newStatus === "For Release"
              ? buildReleaseMessage({ customerName, vehicleUnit, plate, operatingHours: await getOperatingHoursText() })
              : buildCompletionMessage({ customerName, vehicleUnit, plate })

            await sendMessengerText(psid, message)
          }
        } catch (msgErr) {
          console.error("[job-orders PATCH] customer status message failed:", msgErr)
        }
      }
    } else if (head_detailer_id !== undefined || head_installer_id !== undefined || scheduled_at !== undefined) {
      const { data: profile } = await admin.from("user_account").select("full_name, role").eq("id", user.id).single()
      if (profile) {
        const isScheduleOnly = scheduled_at !== undefined && head_detailer_id === undefined && head_installer_id === undefined
        logAudit({
          user_id:   user.id,
          user_name: profile.full_name,
          role:      profile.role,
          category:  "update",
          action:    isScheduleOnly ? "Updated scheduled start" : "Updated job assignment",
          target:    current?.customer_name ?? id,
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
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

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
        target:    job.customer_name ?? id,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
