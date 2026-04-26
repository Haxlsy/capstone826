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

type ServiceType = typeof VALID_SERVICE_TYPES[number]

interface Stage {
  name: string
  category_id: string
  sequence_order: number
}

export async function POST(request: Request) {
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
  const { serviceType, serviceName, description, estimatedDurationMins, stages } = body

  if (!serviceName) {
    return NextResponse.json({ error: "Service name is required." }, { status: 400 })
  }

  if (!serviceType || !(VALID_SERVICE_TYPES as readonly string[]).includes(serviceType)) {
    return NextResponse.json({ error: "A valid service type is required." }, { status: 400 })
  }

  const serviceInsert: Record<string, unknown> = {
    name:         serviceName.trim(),
    service_type: (serviceType as ServiceType).trim(),
    description:  description?.trim() || null,
    is_archived:  false,
  }

  if (estimatedDurationMins !== undefined && estimatedDurationMins !== null && estimatedDurationMins !== "") {
    serviceInsert.estimated_duration_mins = Number(estimatedDurationMins)
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

  if (stages && (stages as Stage[]).length > 0) {
    const stageRows = (stages as Stage[]).map((s) => ({
      service_id:     service.id,
      name:           s.name,
      category_id:    s.category_id,
      sequence_order: s.sequence_order,
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

  return NextResponse.json({ success: true, serviceId: service.id })
}
