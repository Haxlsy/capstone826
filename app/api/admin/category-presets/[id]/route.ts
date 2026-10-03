import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminCaller } from "@/lib/auth/guard"
import { auditCallerOf } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { findDuplicateStageName } from "@/lib/admin/service-stage-validation"

// PUT /api/admin/category-presets/[id]
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAdminCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const admin = createAdminClient()

    const { id } = await params
    const body = await request.json()
    const { name, technician_role, display_color, stages } = body

    if (!name?.trim()) return NextResponse.json({ error: "Preset name is required." }, { status: 400 })
    if (technician_role !== "detailer" && technician_role !== "installer") {
      return NextResponse.json({ error: "technician_role must be 'detailer' or 'installer'." }, { status: 400 })
    }
    const dup = findDuplicateStageName(Array.isArray(stages) ? stages : [])
    if (dup) {
      return NextResponse.json({ error: `Two stages are both named "${dup}" — stage names must be unique.` }, { status: 400 })
    }

    const { error: updateErr } = await admin
      .from("category_preset")
      .update({ name: name.trim(), technician_role, display_color: display_color ?? "blue" })
      .eq("id", id)

    if (updateErr) {
      if (updateErr.code === "23505") {
        return NextResponse.json({ error: `A preset named "${name.trim()}" already exists.` }, { status: 409 })
      }
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    await admin.from("category_preset_stage").delete().eq("preset_id", id)

    const stageRows = Array.isArray(stages)
      ? stages.map((s: { name: string; stage_duration_mins: number }, i: number) => ({
          preset_id:           id,
          name:                String(s.name ?? "").trim() || `Stage ${i + 1}`,
          sequence_order:      i + 1,
          stage_duration_mins: Number(s.stage_duration_mins) || 0,
        }))
      : []

    if (stageRows.length > 0) {
      const { error: stagesErr } = await admin.from("category_preset_stage").insert(stageRows)
      if (stagesErr) return NextResponse.json({ error: stagesErr.message }, { status: 500 })
    }

    await logAuditCall(auditCallerOf(caller), {
      category: "update",
      action:   "Updated workflow category preset",
      target:   name.trim(),
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// DELETE /api/admin/category-presets/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAdminCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const admin = createAdminClient()

    const { id } = await params
    const { data: preset } = await admin
      .from("category_preset")
      .select("name")
      .eq("id", id)
      .maybeSingle()

    const { error } = await admin.from("category_preset").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAuditCall(auditCallerOf(caller), {
      category: "delete",
      action:   "Deleted workflow category preset",
      target:   preset?.name ?? `preset ${id}`,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
