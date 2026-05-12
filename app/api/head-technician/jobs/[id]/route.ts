import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { addWorkingMins } from "@/hooks/time-utils"

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
    timeZone: "Asia/Manila",
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
        `id, status, scheduled_at, actual_start_at, created_at, finishing_approved_at, category_handoffs,
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
      .select("id, status, rework_instructions, handoff_notes, completion_notes, completed_at, stage_duration_mins, service_stage_id, media:stage_media(id, file_url, media_type)")
      .eq("job_order_id", id)

    // Step 2: resolve service_stage details + category names via explicit two-step lookup.
    // FK embedding (workflow_category(name)) silently returns null in this codebase.
    const ssIds = (stageRows ?? [])
      .map((s: any) => s.service_stage_id as string | null)
      .filter(Boolean) as string[]

    type SSInfo = { name: string; sequence_order: number; category: string; category_id: string; category_role: string; category_color: string; stage_duration_mins: number }
    const ssMap: Record<string, SSInfo> = {}
    if (ssIds.length > 0) {
      const { data: ssRows } = await admin
        .from("service_stage")
        .select("id, name, sequence_order, stage_duration_mins, category_id")
        .in("id", ssIds)

      // Step 2b: resolve category name + technician_role + display_color from workflow_category
      const catIds = [...new Set(
        (ssRows ?? []).map((s: any) => s.category_id as string | null).filter(Boolean)
      )] as string[]

      const catInfoMap: Map<string, { name: string; role: string; color: string }> = new Map()
      if (catIds.length > 0) {
        const { data: catRows } = await admin
          .from("workflow_category")
          .select("id, name, technician_role, display_color")
          .in("id", catIds)
        for (const c of (catRows ?? []) as any[]) {
          catInfoMap.set(c.id as string, { name: c.name as string, role: c.technician_role as string, color: c.display_color as string ?? "blue" })
        }
      }

      for (const ss of (ssRows ?? []) as any[]) {
        const catInfo = catInfoMap.get(ss.category_id)
        ssMap[ss.id] = {
          name:                ss.name,
          sequence_order:      ss.sequence_order,
          stage_duration_mins: (ss as any).stage_duration_mins ?? 0,
          category:            catInfo?.name  ?? "preparation",
          category_id:         ss.category_id as string,
          category_role:       catInfo?.role  ?? "detailer",
          category_color:      catInfo?.color ?? "blue",
        }
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

    // Role-based stage grouping — works for any category names.
    const stagesWithInfo = stages.filter((s: any) => s.stageInfo !== null)
    const installerStages = stagesWithInfo.filter((s: any) => s.stageInfo.category_role === "installer")
    const detailerStages  = stagesWithInfo.filter((s: any) => s.stageInfo.category_role === "detailer")

    // Pre-installation detailer stages = detailer stages that come before any installer stage (by sequence_order).
    const minInstallerSeq = installerStages.length > 0
      ? Math.min(...installerStages.map((s: any) => s.stageInfo.sequence_order as number))
      : 999999
    const preInstallDetailerStages = detailerStages.filter(
      (s: any) => s.stageInfo.sequence_order < minInstallerSeq
    )

    // preparation_finished: all pre-install detailer stages done (gate for head installer entry).
    const preparation_finished =
      installerStages.length === 0 ||
      preInstallDetailerStages.length === 0 ||
      preInstallDetailerStages.every((s: any) => s.status === "done")

    // Build a map of categoryId → { role, minSeq, maxSeq } for handoff gating.
    const catSeqMap = new Map<string, { role: string; maxSeq: number; minSeq: number }>()
    for (const [, info] of Object.entries(ssMap)) {
      const catId = info.category_id
      const seq   = info.sequence_order
      const cur   = catSeqMap.get(catId)
      if (!cur) catSeqMap.set(catId, { role: info.category_role, maxSeq: seq, minSeq: seq })
      else catSeqMap.set(catId, { role: info.category_role, maxSeq: Math.max(cur.maxSeq, seq), minSeq: Math.min(cur.minSeq, seq) })
    }

    const categoryHandoffs = ((j as any).category_handoffs ?? {}) as Record<string, string>

    // Per-stage unlock: requires BOTH conditions:
    // 1. All OTHER-role stages with lower sequence_order are done (work is complete).
    // 2. All preceding OTHER-role categories have been explicitly approved via category_handoffs
    //    (prevents auto-unlock as soon as the last stage is marked done).
    const computedStages = stagesWithInfo.map((s: any) => {
      const myRole = s.stageInfo.category_role as string
      const mySeq  = s.stageInfo.sequence_order as number

      const otherRolePreceding = stagesWithInfo.filter((o: any) =>
        (o.stageInfo.category_role as string) !== myRole &&
        (o.stageInfo.sequence_order as number) < mySeq
      )
      const allPriorOtherDone = otherRolePreceding.every((o: any) => o.status === "done")

      // All preceding other-role categories must have an explicit handoff approval entry.
      const precedingOtherCats = [...catSeqMap.entries()].filter(
        ([, info]) => info.role !== myRole && info.maxSeq < mySeq
      )
      const allPriorCatsApproved = precedingOtherCats.every(([catId]) => catId in categoryHandoffs)

      const is_unlocked = allPriorOtherDone && allPriorCatsApproved
      return { ...s, is_unlocked }
    })

    // Which role owns the last stage by sequence order? That role gets "Pass to Operations".
    const sortedBySeq = [...stagesWithInfo].sort((a: any, b: any) =>
      (b.stageInfo.sequence_order as number) - (a.stageInfo.sequence_order as number)
    )
    const last_stage_role: string = (sortedBySeq[0]?.stageInfo.category_role as string) ?? "detailer"

    // handoff notes from the last done detailer stage (kept for backward compat)
    const lastPrep     = preInstallDetailerStages.filter((s: any) => s.status === "done").at(-1)
    const handoffNotes = (lastPrep as any)?.handoff_notes ?? null

    // Build a lookup from jsp id → computed is_unlocked
    const unlockedMap = new Map(computedStages.map((s: any) => [s.id as string, s.is_unlocked as boolean]))

    // Compute expected_end_at and is_delayed per stage using working-hours-aware accumulation
    const expectedEndMap  = new Map<string, string>()
    const isDelayedMap    = new Map<string, boolean>()
    if (j.actual_start_at) {
      const sorted = [...stagesWithInfo].sort(
        (a: any, b: any) => (a.stageInfo.sequence_order as number) - (b.stageInfo.sequence_order as number)
      )
      const jobStart = new Date(j.actual_start_at as string)
      const nowMs    = Date.now()
      let cumulativeMins = 0
      for (const s of sorted as any[]) {
        const overrideDuration = s.stage_duration_mins as number | null
        const serviceDuration  = s.stageInfo?.stage_duration_mins ?? 0
        const durationMins     = overrideDuration != null ? overrideDuration : serviceDuration
        cumulativeMins += durationMins
        if (durationMins > 0) {
          const expectedEnd = addWorkingMins(jobStart, cumulativeMins)
          expectedEndMap.set(s.id as string, expectedEnd.toISOString())
          const stStatus = s.status as string
          isDelayedMap.set(s.id as string, stStatus !== "done" && stStatus !== "for_rework" && nowMs > expectedEnd.getTime())
        }
      }
    }

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
        preparation_finished,
        last_stage_role,
        finishing_approved_at: j.finishing_approved_at ?? null,
        category_handoffs:     categoryHandoffs,
        detailers,
        installers,
        timeline: (history ?? []).map((h: any) => ({
          status:     h.status,
          changed_at: fmtDate(h.created_at),
          changed_by: (h.changed_by as any)?.full_name ?? "System",
        })),
        stages: stages.map((s: any) => ({
          id:                   s.id,
          name:                 s.stageInfo?.name                ?? "Stage",
          order:                s.stageInfo?.sequence_order      ?? 0,
          category:             s.stageInfo?.category            ?? "preparation",
          category_id:          s.stageInfo?.category_id         ?? null,
          category_role:        s.stageInfo?.category_role       ?? "detailer",
          category_color:       s.stageInfo?.category_color ?? null,
          stage_duration_mins:  (s.stage_duration_mins as number | null) ?? s.stageInfo?.stage_duration_mins ?? 0,
          expected_end_at:      expectedEndMap.get(s.id as string) ?? null,
          is_delayed:           isDelayedMap.get(s.id as string) ?? false,
          is_unlocked:          unlockedMap.get(s.id as string) ?? true,
          status:               s.status,
          rework_instructions:  s.rework_instructions  ?? null,
          handoff_notes:        s.handoff_notes         ?? null,
          completion_notes:     s.completion_notes      ?? null,
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
    const { action, stage_id, handoff_notes, completion_notes, media_url, media_type, stage_ids, rework_instructions } = body

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
      if (!completion_notes?.trim()) return NextResponse.json({ error: "Completion notes are required." }, { status: 400 })

      await admin
        .from("job_stage_progress")
        .update({
          status:           "done",
          completed_at:     new Date().toISOString(),
          completed_by_id:  user.id,
          handoff_notes:    handoff_notes    ?? null,
          completion_notes: completion_notes ?? null,
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

      // Recalculate expected_completion_at from remaining stage durations (prefer per-job override over template)
      const { data: remainingStages } = await admin
        .from("job_stage_progress")
        .select("stage_duration_mins, service_stage:service_stage_id(stage_duration_mins)")
        .eq("job_order_id", jobId)
        .neq("status", "done")

      if ((remainingStages ?? []).length > 0) {
        const remainingMins = (remainingStages ?? []).reduce((acc: number, s: any) => {
          const override = s.stage_duration_mins as number | null
          const base     = (s.service_stage as any)?.stage_duration_mins ?? 0
          return acc + (override != null ? override : base)
        }, 0)
        if (remainingMins > 0) {
          const newCompletion = addWorkingMins(new Date(), remainingMins)
          await admin.from("job_order").update({ expected_completion_at: newCompletion.toISOString() }).eq("id", jobId)
        }
      } else {
        // All stages done — check current job status before updating
        const { data: jobRow } = await admin
          .from("job_order")
          .select("status")
          .eq("id", jobId)
          .single()
        const currentStatus = (jobRow as any)?.status as string | undefined

        const jobUpdate: Record<string, unknown> = { expected_completion_at: new Date().toISOString() }
        if (currentStatus === "For Rework") {
          jobUpdate.status = "For Inspection"
        }
        await admin.from("job_order").update(jobUpdate).eq("id", jobId)

        if (currentStatus === "For Rework") {
          await admin.from("job_order_history").insert({
            job_order_id:  jobId,
            status:        "For Inspection",
            changed_by_id: user.id,
          })
        }
      }

      return NextResponse.json({ success: true })
    }

    if (action === "approve") {
      // category_id is required — identifies which category is being handed off.
      const category_id = body.category_id as string | null
      if (!category_id) return NextResponse.json({ error: "category_id is required." }, { status: 400 })

      // Merge the approved category into category_handoffs.
      const { data: jobRow } = await admin.from("job_order").select("category_handoffs").eq("id", jobId).single()
      const currentHandoffs  = ((jobRow as any)?.category_handoffs ?? {}) as Record<string, string>
      const updatedHandoffs  = { ...currentHandoffs, [category_id]: new Date().toISOString() }
      await admin.from("job_order").update({ category_handoffs: updatedHandoffs }).eq("id", jobId)

      // Save handoff notes to the last stage of this category.
      if (handoff_notes) {
        const { data: jspRows } = await admin
          .from("job_stage_progress")
          .select("id, service_stage_id")
          .eq("job_order_id", jobId)

        const ssIds = (jspRows ?? []).map((s: any) => s.service_stage_id as string | null).filter(Boolean) as string[]
        if (ssIds.length > 0) {
          const { data: ssRows } = await admin
            .from("service_stage")
            .select("id, sequence_order")
            .in("id", ssIds)
            .eq("category_id", category_id)
            .order("sequence_order", { ascending: false })
            .limit(1)

          if (ssRows && ssRows.length > 0) {
            const lastJsp = (jspRows ?? []).find((s: any) => s.service_stage_id === ssRows[0].id)
            if (lastJsp) {
              await admin.from("job_stage_progress").update({ handoff_notes }).eq("id", lastJsp.id)
            }
          }
        }
      }

      return NextResponse.json({ success: true })
    }

    if (action === "approve_finishing") {
      const { data: profile } = await admin
        .from("user_account")
        .select("role")
        .eq("id", user.id)
        .single()

      const callerRole = (profile as any)?.role as string | undefined
      if (callerRole !== "head_detailer" && callerRole !== "head_installer") {
        return NextResponse.json({ error: "Unauthorized." }, { status: 403 })
      }

      // Determine last_stage_role for this job (same logic as GET)
      const { data: allJspForRole } = await admin
        .from("job_stage_progress")
        .select("id, status, service_stage_id")
        .eq("job_order_id", jobId)

      const allSsIdsForRole = (allJspForRole ?? [])
        .map((s: any) => s.service_stage_id as string | null).filter(Boolean) as string[]
      let jobLastStageRole = "detailer"
      if (allSsIdsForRole.length > 0) {
        const { data: allSsForRole } = await admin
          .from("service_stage")
          .select("id, sequence_order, category_id")
          .in("id", allSsIdsForRole)
        const allCatIds = [...new Set((allSsForRole ?? []).map((s: any) => s.category_id as string | null).filter(Boolean))] as string[]
        if (allCatIds.length > 0) {
          const { data: allCatRows } = await admin
            .from("workflow_category")
            .select("id, technician_role")
            .in("id", allCatIds)
          const catRoleMap = new Map((allCatRows ?? []).map((c: any) => [c.id as string, c.technician_role as string]))
          const sorted = [...(allSsForRole ?? [])].sort((a: any, b: any) =>
            (b.sequence_order as number) - (a.sequence_order as number)
          )
          jobLastStageRole = catRoleMap.get((sorted[0] as any)?.category_id) ?? "detailer"
        }
      }

      const expectedCallerRole = jobLastStageRole === "installer" ? "head_installer" : "head_detailer"
      if (callerRole !== expectedCallerRole) {
        return NextResponse.json({
          error: `Only the ${expectedCallerRole.replace("_", " ")} can pass this job to operations.`,
        }, { status: 403 })
      }

      // Validate ALL stages are done — category-agnostic so any workflow shape is supported.
      const { data: allJspRows } = await admin
        .from("job_stage_progress")
        .select("id, status")
        .eq("job_order_id", jobId)

      const allDone = (allJspRows ?? []).length > 0 && (allJspRows ?? []).every((s: any) => s.status === "done")
      if (!allDone) {
        return NextResponse.json(
          { error: "All stages must be marked done before passing to operations." },
          { status: 400 }
        )
      }

      const { error: updateErr } = await admin
        .from("job_order")
        .update({ 
          finishing_approved_at: new Date().toISOString(),
          status: "For Inspection"
        })
        .eq("id", jobId)

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

      return NextResponse.json({ success: true })
    }

    // Unified flag_rework — handles all categories dynamically.
    // Notifies the OTHER role's head tech based on who is calling.
    if (action === "flag_rework" || action === "flag_prep_rework" || action === "flag_finishing_rework") {
      if (!Array.isArray(stage_ids) || stage_ids.length === 0) {
        return NextResponse.json({ error: "stage_ids is required." }, { status: 400 })
      }
      if (!rework_instructions?.trim()) {
        return NextResponse.json({ error: "rework_instructions is required." }, { status: 400 })
      }

      const { data: callerProfile } = await admin
        .from("user_account")
        .select("role")
        .eq("id", user.id)
        .single()
      const callerIsInstaller = (callerProfile as any)?.role === "head_installer"

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

      // Notify the other role's head technician.
      const notifyRole = callerIsInstaller ? "head_detailer" : "head_installer"
      const { data: team } = await admin
        .from("job_order_team")
        .select("user_account_id, role_in_job")
        .eq("job_order_id", jobId)
        .eq("role_in_job", notifyRole)

      const notifRows = (team ?? [])
        .filter((t: any) => t.user_account_id)
        .map((t: any) => ({
          user_id:      t.user_account_id,
          type:         "rework",
          message:      `Stage(s) have been flagged for rework. Instructions: ${rework_instructions.trim()}`,
          job_order_id: jobId,
        }))

      if (notifRows.length > 0) await admin.from("notification").insert(notifRows)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
