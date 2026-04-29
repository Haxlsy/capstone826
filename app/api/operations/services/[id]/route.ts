import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit"


// GET /api/operations/services/[id]
// Returns a single service with its stages (including category info) for editing.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const [serviceRes, stagesRes] = await Promise.all([
      supabase
        .from("service")
        .select("id, name, service_type, description, estimated_duration_mins, is_archived")
        .eq("id", id)
        .single(),
      supabase
        .from("service_stage")
        .select("id, name, sequence_order, stage_duration_mins, workflow_category(id, name, technician_role, display_color)")
        .eq("service_id", id)
        .order("sequence_order"),
    ])

    if (serviceRes.error) return NextResponse.json({ error: serviceRes.error.message }, { status: 500 })
    if (!serviceRes.data)  return NextResponse.json({ error: "Service not found." }, { status: 404 })

    const stages = (stagesRes.data ?? []).map((s) => {
      const cat = Array.isArray(s.workflow_category)
        ? s.workflow_category[0]
        : s.workflow_category
      return {
        id:                  s.id,
        name:                s.name,
        sequence_order:      s.sequence_order,
        stage_duration_mins: (s as unknown as { stage_duration_mins: number }).stage_duration_mins ?? 0,
        category_id:         cat?.id    ?? null,
        category_name:       cat?.name  ?? null,
        category_role:       cat?.technician_role ?? null,
        category_color:      cat?.display_color ?? null,
      }
    })

    return NextResponse.json({
      service: serviceRes.data,
      stages,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH /api/operations/services/[id]
// Body (archive toggle): { is_archived: boolean }
// Body (full edit):      { serviceType, serviceName, description, estimatedDurationMins, stages }
//   Each stage: { dbId?: string | null, name: string, category_id: string, sequence_order: number }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createClient(cookieStore)
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const { id }  = await params
    const body    = await request.json()
    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from("user_account")
      .select("full_name, role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 })
    }

    // Archive toggle
    if (typeof body.is_archived === "boolean") {
      // Guard: block archiving if live job orders reference this service
      if (body.is_archived) {
        const LIVE = ["Pending", "Ongoing", "For Rework", "For Inspection", "For Release", "Delayed"]
        const { data: liveJobRows } = await supabase
          .from("job_order")
          .select("id, status, customer_name, created_at")
          .eq("service_id", id)
          .in("status", LIVE)
          .limit(5)

        if ((liveJobRows ?? []).length > 0) {
          const liveJobs = (liveJobRows ?? []).map((j) => {
            const year    = new Date(j.created_at).getFullYear()
            const shortId = (j.id as string).slice(-4).toUpperCase()
            return `JO-${year}-${shortId} (${j.customer_name}) — ${j.status}`
          })
          return NextResponse.json(
            { error: "Cannot archive — this service is being used in active job orders.", liveJobs },
            { status: 409 }
          )
        }
      }

      const { data: svc, error } = await supabase
        .from("service")
        .update({ is_archived: body.is_archived })
        .eq("id", id)
        .select("name")
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      logAudit({
        user_id:   user.id,
        user_name: profile.full_name,
        role:      profile.role,
        category:  "delete",
        action:    body.is_archived ? "Archived service" : "Restored service",
        target:    svc?.name ?? id,
      })
      return NextResponse.json({ success: true })
    }

    // Full edit
    const { serviceType, serviceName, description, stages } = body

    if (!serviceName?.trim()) {
      return NextResponse.json({ error: "Service name is required." }, { status: 400 })
    }
    if (!serviceType?.trim()) {
      return NextResponse.json({ error: "Service type is required." }, { status: 400 })
    }

    // ── Smart stage update (avoid FK violations on job_stage_progress) ──
    type StagePayload = { dbId: string | null; name: string; category_id: string; sequence_order: number; stage_duration_mins: number }
    const stageList: StagePayload[] = Array.isArray(stages) ? stages : []

    // Derive estimated_duration_mins from stage durations
    const derivedDuration = stageList.reduce((acc, s) => acc + (s.stage_duration_mins ?? 0), 0)

    const { error: updateError } = await supabase
      .from("service")
      .update({
        name:                   serviceName.trim(),
        service_type:           serviceType.trim(),
        description:            description?.trim() || null,
        estimated_duration_mins: derivedDuration,
      })
      .eq("id", id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // 1. Find which existing DB stage IDs were removed by the user
    const keptDbIds = new Set(stageList.filter((s) => s.dbId).map((s) => s.dbId as string))

    const { data: currentStages } = await supabase
      .from("service_stage")
      .select("id")
      .eq("service_id", id)

    const removedIds = (currentStages ?? [])
      .map((s) => s.id as string)
      .filter((sid) => !keptDbIds.has(sid))

    // 2. Delete only removed stages that have no job_stage_progress references
    let blockedStageIds: string[] = []
    if (removedIds.length > 0) {
      const { data: referenced } = await supabase
        .from("job_stage_progress")
        .select("service_stage_id")
        .in("service_stage_id", removedIds)

      const referencedSet = new Set((referenced ?? []).map((r) => r.service_stage_id as string))
      const safeToDelete  = removedIds.filter((sid) => !referencedSet.has(sid))
      blockedStageIds     = removedIds.filter((sid) => referencedSet.has(sid))

      if (safeToDelete.length > 0) {
        const { error: delErr } = await supabase
          .from("service_stage")
          .delete()
          .in("id", safeToDelete)
        if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
      }
    }

    // 3. Update existing stages
    for (const s of stageList.filter((s) => s.dbId)) {
      const { error: upErr } = await supabase
        .from("service_stage")
        .update({
          name:                s.name,
          category_id:         s.category_id,
          sequence_order:      s.sequence_order,
          stage_duration_mins: s.stage_duration_mins ?? 0,
        })
        .eq("id", s.dbId as string)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    // 4. Insert new stages
    const newStages = stageList.filter((s) => !s.dbId)
    if (newStages.length > 0) {
      const { error: insErr } = await supabase
        .from("service_stage")
        .insert(newStages.map((s) => ({
          service_id:          id,
          name:                s.name,
          category_id:         s.category_id,
          sequence_order:      s.sequence_order,
          stage_duration_mins: s.stage_duration_mins ?? 0,
        })))
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    logAudit({
      user_id:   user.id,
      user_name: profile.full_name,
      role:      profile.role,
      category:  "update",
      action:    "Updated service",
      target:    serviceName.trim(),
    })

    // If some stages couldn't be removed because of active job references, surface them
    if (blockedStageIds.length > 0) {
      const { data: blockedRows } = await supabase
        .from("service_stage")
        .select("name")
        .in("id", blockedStageIds)
      const blockedStageNames = (blockedRows ?? []).map((s) => s.name as string)
      return NextResponse.json({
        success: true,
        warning: "Some stages could not be removed because they are referenced by active job orders.",
        blockedStageNames,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
