import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const VALID_SERVICE_TYPES = [
  "Paint Protection Film",
  "Coating Services",
  "Auto Detailing",
  "Nano Ceramic Tint",
] as const

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
        .select("id, name, sequence_order, workflow_category(id, name, technician_role, display_color)")
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
        id:             s.id,
        name:           s.name,
        sequence_order: s.sequence_order,
        category_id:    cat?.id    ?? null,
        category_name:  cat?.name  ?? null,
        category_role:  cat?.technician_role ?? null,
        category_color: cat?.display_color ?? null,
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
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 })
    }

    // Archive toggle
    if (typeof body.is_archived === "boolean") {
      const { error } = await supabase
        .from("service")
        .update({ is_archived: body.is_archived })
        .eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Full edit
    const { serviceType, serviceName, description, estimatedDurationMins, stages } = body

    if (!serviceName?.trim()) {
      return NextResponse.json({ error: "Service name is required." }, { status: 400 })
    }
    if (!serviceType || !(VALID_SERVICE_TYPES as readonly string[]).includes(serviceType)) {
      return NextResponse.json({ error: "A valid service type is required." }, { status: 400 })
    }

    const updatePayload: Record<string, unknown> = {
      name:         serviceName.trim(),
      service_type: serviceType.trim(),
      description:  description?.trim() || null,
    }
    if (estimatedDurationMins !== undefined && estimatedDurationMins !== null) {
      updatePayload.estimated_duration_mins = Number(estimatedDurationMins)
    }

    const { error: updateError } = await supabase
      .from("service")
      .update(updatePayload)
      .eq("id", id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // ── Smart stage update (avoid FK violations on job_stage_progress) ──
    type StagePayload = { dbId: string | null; name: string; category_id: string; sequence_order: number }
    const stageList: StagePayload[] = Array.isArray(stages) ? stages : []

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
    if (removedIds.length > 0) {
      const { data: referenced } = await supabase
        .from("job_stage_progress")
        .select("service_stage_id")
        .in("service_stage_id", removedIds)

      const referencedSet = new Set((referenced ?? []).map((r) => r.service_stage_id as string))
      const safeToDelete  = removedIds.filter((sid) => !referencedSet.has(sid))

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
        .update({ name: s.name, category_id: s.category_id, sequence_order: s.sequence_order })
        .eq("id", s.dbId as string)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    // 4. Insert new stages
    const newStages = stageList.filter((s) => !s.dbId)
    if (newStages.length > 0) {
      const { error: insErr } = await supabase
        .from("service_stage")
        .insert(newStages.map((s) => ({
          service_id:     id,
          name:           s.name,
          category_id:    s.category_id,
          sequence_order: s.sequence_order,
        })))
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
