import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

export async function GET(
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

    const { data: profile } = await admin
      .from("user_account")
      .select("role")
      .eq("id", user.id)
      .single()

    const role = (profile as any)?.role as string | undefined

    const { data: job, error } = await admin
      .from("job_order")
      .select(
        `id, status, scheduled_at, actual_start_at, created_at, finishing_approved_at,
         customer:customer_record_id(full_name, plate_number, vehicle_unit),
         service:service_id(name),
         customer_name, plate_number, vehicle_unit`
      )
      .eq("id", id)
      .single()

    if (error || !job) {
      console.error("[HT job detail] query failed — id:", id, "error:", error?.message, "code:", error?.code)
      return NextResponse.json({ error: error?.message ?? "Not found." }, { status: 404 })
    }

    const { data: team } = await admin
      .from("job_order_team")
      .select("role_in_job, user_account:user_account_id(id, full_name), technician:technician_id(id, full_name)")
      .eq("job_order_id", id)

    const { data: history } = await admin
      .from("job_order_history")
      .select("status, created_at, changed_by:changed_by_id(full_name)")
      .eq("job_order_id", id)
      .order("created_at", { ascending: true })

    // Two-step query to avoid PostgREST FK embedding ambiguity (silently returns null).
    // Step 1: raw job_stage_progress rows
    const { data: stageRows } = await admin
      .from("job_stage_progress")
      .select("id, status, rework_instructions, handoff_notes, completed_at, service_stage_id, media:stage_media(id, file_url, media_type)")
      .eq("job_order_id", id)

    // Step 2: resolve service_stage details in a single IN query
    const ssIds = (stageRows ?? [])
      .map((s: any) => s.service_stage_id as string | null)
      .filter(Boolean) as string[]

    type SSInfo = { name: string; sequence_order: number; category: string }
    const ssMap: Record<string, SSInfo> = {}
    if (ssIds.length > 0) {
      const { data: ssRows } = await admin
        .from("service_stage")
        .select("id, name, sequence_order, category")
        .in("id", ssIds)
      for (const ss of (ssRows ?? []) as any[]) {
        ssMap[ss.id] = { name: ss.name, sequence_order: ss.sequence_order, category: ss.category }
      }
    }

    // Merge and sort by sequence_order so display order is always correct
    const stages = (stageRows ?? [])
      .map((s: any) => ({ ...s, stageInfo: s.service_stage_id ? (ssMap[s.service_stage_id] ?? null) : null }))
      .sort((a: any, b: any) => (a.stageInfo?.sequence_order ?? 999) - (b.stageInfo?.sequence_order ?? 999))

    const j = job as any
    const leaderRole  = role === "head_installer" ? "head_installer" : "head_detailer"
    const leader      = (team ?? []).find((t: any) => t.role_in_job === leaderRole)

    const detailers  = (team ?? [])
      .filter((t: any) => t.role_in_job === "detailer")
      .map((t: any) => (t.technician as any)?.full_name ?? "Unknown")
    const installers = (team ?? [])
      .filter((t: any) => t.role_in_job === "installer")
      .map((t: any) => (t.technician as any)?.full_name ?? "Unknown")

    const prepStages    = stages.filter((s: any) => s.stageInfo?.category === "preparation")
    const installStages = stages.filter((s: any) => s.stageInfo?.category === "installation")
    const lastPrep      = prepStages.filter((s: any) => s.status === "done").at(-1)
    const handoffNotes  = (lastPrep as any)?.handoff_notes ?? null

    return NextResponse.json({
      job: {
        job_id:                `JO-${new Date(j.created_at).getFullYear()}-${id.slice(-4).toUpperCase()}`,
        raw_id:                j.id,
        customer_name:         (j.customer as any)?.full_name    ?? j.customer_name    ?? "—",
        plate_number:          (j.customer as any)?.plate_number ?? j.plate_number     ?? "—",
        car_make:              (j.customer as any)?.vehicle_unit ?? j.vehicle_unit     ?? "—",
        service:               (j.service as any)?.name          ?? "—",
        technician_name:       (leader?.user_account as any)?.full_name ?? "—",
        scheduled_start:       fmtDate(j.scheduled_at),
        status:                j.status,
        handoff_notes:         handoffNotes,
        preparation_finished:  prepStages.length > 0 && prepStages.every((s: any) => s.status === "done"),
        installation_finished: installStages.length > 0 && installStages.every((s: any) => s.status === "done"),
        finishing_approved_at: j.finishing_approved_at ?? null,
        detailers,
        installers,
        timeline: (history ?? []).map((h: any) => ({
          status:     h.status,
          changed_at: fmtDate(h.created_at),
          changed_by: (h.changed_by as any)?.full_name ?? "System",
        })),
        stages: stages.map((s: any) => ({
          id:                   s.id,
          name:                 s.stageInfo?.name           ?? "Stage",
          order:                s.stageInfo?.sequence_order ?? 0,
          category:             s.stageInfo?.category       ?? "preparation",
          status:               s.status,
          rework_instructions:  s.rework_instructions ?? null,
          handoff_notes:        s.handoff_notes       ?? null,
          completed_at:         s.completed_at ? fmtDate(s.completed_at) : null,
          media:                (s.media ?? []).map((m: any) => ({
            id:   m.id,
            url:  m.file_url,
            type: m.media_type,
          })),
        })),
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── PATCH — stage actions ─────────────────────────────────────────────────────
// action: "start_job" | "mark_stage_done" | "approve" | "approve_finishing"
//       | "flag_rework" | "flag_prep_rework" | "flag_finishing_rework"
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const body          = await request.json()
    const { action, stage_id, handoff_notes, media_url, media_type, stage_ids, rework_instructions } = body

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    if (action === "start_job") {
      const { data: profile } = await admin
        .from("user_account")
        .select("role")
        .eq("id", user.id)
        .single()

      if ((profile as any)?.role !== "head_detailer") {
        return NextResponse.json({ error: "Unauthorized: Only the Head Detailer can start the job." }, { status: 403 })
      }

      await admin
        .from("job_order")
        .update({ status: "Ongoing", actual_start_at: new Date().toISOString() })
        .eq("id", jobId)
      await admin.from("job_order_history").insert({
        job_order_id:  jobId,
        status:        "Ongoing",
        changed_by_id: user.id,
      })
      return NextResponse.json({ success: true })
    }

    if (action === "mark_stage_done") {
      if (!stage_id) return NextResponse.json({ error: "stage_id is required." }, { status: 400 })

      await admin
        .from("job_stage_progress")
        .update({
          status:          "done",
          completed_at:    new Date().toISOString(),
          completed_by_id: user.id,
          handoff_notes:   handoff_notes ?? null,
        })
        .eq("id", stage_id)
        .eq("job_order_id", jobId)

      if (media_url && media_type) {
        await admin.from("stage_media").insert({
          job_stage_progress_id: stage_id,
          media_type,
          file_url:              media_url,
          uploaded_by_id:        user.id,
        })
      }

      return NextResponse.json({ success: true })
    }

    if (action === "approve") {
      const { data: profile } = await admin
        .from("user_account")
        .select("role")
        .eq("id", user.id)
        .single()

      const isInstaller = (profile as any)?.role === "head_installer"

      let newStatus = "Ongoing"

      if (isInstaller) {
        // Check whether finishing stages exist for this job.
        // Two-step query avoids PostgREST embedding ambiguity inside PATCH handlers.
        const { data: jspRows } = await admin
          .from("job_stage_progress")
          .select("service_stage_id, custom_stage_category")
          .eq("job_order_id", jobId)

        // Custom finishing stages (service_stage_id = null, category stored inline)
        const hasCustomFinishing = (jspRows ?? []).some(
          (s: any) => s.custom_stage_category === "finishing"
        )

        // Seeded finishing stages (join service_stage directly)
        let hasSeededFinishing = false
        const ssIds = (jspRows ?? [])
          .map((s: any) => s.service_stage_id as string | null)
          .filter(Boolean) as string[]

        if (!hasCustomFinishing && ssIds.length > 0) {
          const { data: ssRows } = await admin
            .from("service_stage")
            .select("id")
            .in("id", ssIds)
            .eq("category", "finishing")
            .limit(1)
          hasSeededFinishing = (ssRows ?? []).length > 0
        }

        const hasFinishing = hasCustomFinishing || hasSeededFinishing
        newStatus = hasFinishing ? "Ongoing" : "For Release"
      }

      await admin.from("job_order").update({ status: newStatus }).eq("id", jobId)

      if (newStatus !== "Ongoing") {
        await admin.from("job_order_history").insert({
          job_order_id:  jobId,
          status:        newStatus,
          changed_by_id: user.id,
        })
      }

      // Save handoff notes to the last preparation stage (head_detailer only)
      if (handoff_notes && !isInstaller) {
        const { data: prepStages } = await admin
          .from("job_stage_progress")
          .select("id, stage:service_stage_id(category)")
          .eq("job_order_id", jobId)
          .order("service_stage_id")

        const lastPrep = (prepStages ?? [])
          .filter((s: any) => (s.stage as any)?.category === "preparation")
          .at(-1)

        if (lastPrep) {
          await admin
            .from("job_stage_progress")
            .update({ handoff_notes })
            .eq("id", lastPrep.id)
        }
      }

      return NextResponse.json({ success: true })
    }

    if (action === "approve_finishing") {
      // Only head_detailer can pass finishing to ops.
      const { data: profile } = await admin
        .from("user_account")
        .select("role")
        .eq("id", user.id)
        .single()

      if ((profile as any)?.role !== "head_detailer") {
        return NextResponse.json({ error: "Unauthorized: Only the Head Detailer can pass finishing to operations." }, { status: 403 })
      }

      // Validate all finishing stages are done.
      const { data: finishingStages } = await admin
        .from("job_stage_progress")
        .select("id, status, stage:service_stage_id(category)")
        .eq("job_order_id", jobId)

      const finishing = (finishingStages ?? []).filter(
        (s: any) => (s.stage as any)?.category === "finishing"
      )

      const allDone = finishing.length > 0 && finishing.every((s: any) => s.status === "done")
      if (!allDone) {
        return NextResponse.json(
          { error: "All finishing stages must be marked done before passing to operations." },
          { status: 400 }
        )
      }

      const { error: updateErr } = await admin
        .from("job_order")
        .update({ finishing_approved_at: new Date().toISOString() })
        .eq("id", jobId)

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

      return NextResponse.json({ success: true })
    }

    if (action === "flag_rework") {
      if (!Array.isArray(stage_ids) || stage_ids.length === 0) {
        return NextResponse.json({ error: "stage_ids is required." }, { status: 400 })
      }
      if (!rework_instructions?.trim()) {
        return NextResponse.json({ error: "rework_instructions is required." }, { status: 400 })
      }

      const { error: stageErr } = await admin
        .from("job_stage_progress")
        .update({
          status:               "in_progress",
          rework_instructions:  rework_instructions.trim(),
          completed_at:         null,
          completed_by_id:      null,
        })
        .in("id", stage_ids)
        .eq("job_order_id", jobId)

      if (stageErr) return NextResponse.json({ error: stageErr.message }, { status: 500 })

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

      const { data: team } = await admin
        .from("job_order_team")
        .select("user_account_id, role_in_job")
        .eq("job_order_id", jobId)
        .eq("role_in_job", "head_detailer")

      const notifRows = (team ?? [])
        .filter((t: any) => t.user_account_id)
        .map((t: any) => ({
          user_id:      t.user_account_id,
          type:         "rework",
          message:      `Installation stage(s) have been flagged for rework. Instructions: ${rework_instructions.trim()}`,
          job_order_id: jobId,
        }))

      if (notifRows.length > 0) await admin.from("notification").insert(notifRows)

      return NextResponse.json({ success: true })
    }

    if (action === "flag_prep_rework") {
      if (!Array.isArray(stage_ids) || stage_ids.length === 0) {
        return NextResponse.json({ error: "stage_ids is required." }, { status: 400 })
      }
      if (!rework_instructions?.trim()) {
        return NextResponse.json({ error: "rework_instructions is required." }, { status: 400 })
      }

      const { error: stageErr } = await admin
        .from("job_stage_progress")
        .update({
          status:               "in_progress",
          rework_instructions:  rework_instructions.trim(),
          completed_at:         null,
          completed_by_id:      null,
        })
        .in("id", stage_ids)
        .eq("job_order_id", jobId)

      if (stageErr) return NextResponse.json({ error: stageErr.message }, { status: 500 })

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

      const { data: team } = await admin
        .from("job_order_team")
        .select("user_account_id, role_in_job")
        .eq("job_order_id", jobId)
        .eq("role_in_job", "head_installer")

      const notifRows = (team ?? [])
        .filter((t: any) => t.user_account_id)
        .map((t: any) => ({
          user_id:      t.user_account_id,
          type:         "rework",
          message:      `Preparation stage(s) have been flagged for rework. Instructions: ${rework_instructions.trim()}`,
          job_order_id: jobId,
        }))

      if (notifRows.length > 0) await admin.from("notification").insert(notifRows)

      return NextResponse.json({ success: true })
    }

    if (action === "flag_finishing_rework") {
      if (!Array.isArray(stage_ids) || stage_ids.length === 0) {
        return NextResponse.json({ error: "stage_ids is required." }, { status: 400 })
      }
      if (!rework_instructions?.trim()) {
        return NextResponse.json({ error: "rework_instructions is required." }, { status: 400 })
      }

      const { error: stageErr } = await admin
        .from("job_stage_progress")
        .update({
          status:               "in_progress",
          rework_instructions:  rework_instructions.trim(),
          completed_at:         null,
          completed_by_id:      null,
        })
        .in("id", stage_ids)
        .eq("job_order_id", jobId)

      if (stageErr) return NextResponse.json({ error: stageErr.message }, { status: 500 })

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

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
