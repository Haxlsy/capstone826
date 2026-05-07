import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/admin/category-presets
export async function GET() {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("category_preset")
      .select("id, name, technician_role, display_color, created_at, category_preset_stage(id, name, sequence_order, stage_duration_mins)")
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const presets = (data ?? []).map((p) => ({
      ...p,
      stages: [...(p.category_preset_stage ?? [])].sort((a, b) => a.sequence_order - b.sequence_order),
    }))

    return NextResponse.json({ presets })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/admin/category-presets
// Body: { name, technician_role, display_color, stages: [{ name, stage_duration_mins }] }
export async function POST(request: Request) {
  try {
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

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 })
    }

    const body = await request.json()
    const { name, technician_role, display_color, stages } = body

    if (!name?.trim()) return NextResponse.json({ error: "Preset name is required." }, { status: 400 })
    if (technician_role !== "detailer" && technician_role !== "installer") {
      return NextResponse.json({ error: "technician_role must be 'detailer' or 'installer'." }, { status: 400 })
    }

    const { data: preset, error: presetErr } = await admin
      .from("category_preset")
      .insert({ name: name.trim(), technician_role, display_color: display_color ?? "blue" })
      .select("id, name, technician_role, display_color, created_at")
      .single()

    if (presetErr) {
      if (presetErr.code === "23505") {
        return NextResponse.json({ error: `A preset named "${name.trim()}" already exists.` }, { status: 409 })
      }
      return NextResponse.json({ error: presetErr.message }, { status: 500 })
    }

    const stageRows = Array.isArray(stages)
      ? stages.map((s: { name: string; stage_duration_mins: number }, i: number) => ({
          preset_id:           preset.id,
          name:                String(s.name ?? "").trim() || `Stage ${i + 1}`,
          sequence_order:      i + 1,
          stage_duration_mins: Number(s.stage_duration_mins) || 0,
        }))
      : []

    if (stageRows.length > 0) {
      const { error: stagesErr } = await admin.from("category_preset_stage").insert(stageRows)
      if (stagesErr) return NextResponse.json({ error: stagesErr.message }, { status: 500 })
    }

    return NextResponse.json({ preset: { ...preset, stages: stageRows } }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
