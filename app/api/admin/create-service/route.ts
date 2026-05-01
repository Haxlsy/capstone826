import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit-helpers"

interface Stage {
  name:               string
  category_id:        string
  sequence_order:     number
  stage_duration_mins: number
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase    = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_account")
    .select("full_name, role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 })
  }

  const body = await request.json()
  const { serviceType, serviceName, description, stages } = body

  if (!serviceName) {
    return NextResponse.json({ error: "Service name is required." }, { status: 400 })
  }

  if (!serviceType?.trim()) {
    return NextResponse.json({ error: "Service type is required." }, { status: 400 })
  }

  const stageList: Stage[] = Array.isArray(stages) ? stages : []
  const estimatedDurationMins = stageList.reduce((acc, s) => acc + (s.stage_duration_mins ?? 0), 0)

  const serviceInsert: Record<string, unknown> = {
    name:                   serviceName.trim(),
    service_type:           serviceType.trim(),
    description:            description?.trim() || null,
    is_archived:            false,
    estimated_duration_mins: estimatedDurationMins,
  }

  const { data: service, error: serviceError } = await admin
    .from("service")
    .insert(serviceInsert)
    .select("id")
    .single()

  if (serviceError || !service) {
    return NextResponse.json(
      { error: serviceError?.message ?? "Failed to create service." },
      { status: 500 }
    )
  }

  if (stageList.length > 0) {
    const stageRows = stageList.map((s) => ({
      service_id:          service.id,
      name:                s.name,
      category_id:         s.category_id,
      sequence_order:      s.sequence_order,
      stage_duration_mins: s.stage_duration_mins ?? 0,
    }))

    const { error: stageError } = await admin
      .from("service_stage")
      .insert(stageRows)

    if (stageError) {
      await admin.from("service").delete().eq("id", service.id)
      return NextResponse.json(
        { error: stageError.message ?? "Failed to save workflow stages." },
        { status: 500 }
      )
    }
  }

  logAudit({
    user_id:   user.id,
    user_name: profile.full_name,
    role:      profile.role,
    category:  "create",
    action:    "Created service",
    target:    serviceName.trim(),
  })

  return NextResponse.json({ success: true, serviceId: service.id })
}
