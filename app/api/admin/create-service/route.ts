import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

interface Stage {
  name: string
  category: "preparation" | "installation"
  sequence_order: number
}

export async function POST(request: Request) {
  const body = await request.json()
  const { serviceName, description, estimatedDurationMins, stages } = body

  if (!serviceName) {
    return NextResponse.json(
      { error: "Service name is required." },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const serviceInsert: Record<string, unknown> = {
    name:        serviceName.trim(),
    description: description?.trim() || null,
    is_archived: false,
  }

  if (estimatedDurationMins !== undefined && estimatedDurationMins !== null && estimatedDurationMins !== "") {
    serviceInsert.estimated_duration_mins = Number(estimatedDurationMins)
  }

  const { data: service, error: serviceError } = await supabase
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

  // Insert service stages if provided
  if (stages && (stages as Stage[]).length > 0) {
    const stageRows = (stages as Stage[]).map((s) => ({
      service_id:     service.id,
      name:           s.name,
      category:       s.category,
      sequence_order: s.sequence_order,
    }))

    const { error: stageError } = await supabase
      .from("service_stage")
      .insert(stageRows)

    if (stageError) {
      // Rollback: delete the service row
      await supabase.from("service").delete().eq("id", service.id)
      return NextResponse.json(
        { error: stageError.message ?? "Failed to save workflow stages." },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ success: true, serviceId: service.id })
}
