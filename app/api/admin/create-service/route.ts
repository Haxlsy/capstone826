import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

interface Stage {
  stage_name: string
  stage_order: number
}

export async function POST(request: Request) {
  const { serviceName, description, price, estimatedDays, stages } =
    await request.json()

  if (!serviceName || price === undefined || price === null) {
    return NextResponse.json(
      { error: "Service name and price are required." },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get the first active vehicle type to satisfy the FK on service_stage_template
  const { data: vehicleType } = await supabase
    .from("vehicle_type")
    .select("vehicle_type_id")
    .eq("is_active", true)
    .order("vehicle_type_id", { ascending: true })
    .limit(1)
    .single()

  const vehicleTypeId = vehicleType?.vehicle_type_id ?? 1

  // Insert the service row
  const serviceInsert: Record<string, unknown> = {
    service_name: serviceName,
    description: description || null,
    price: Number(price),
    is_archived: false,
  }

  // estimated_duration_days added in v3 — include if column exists
  if (estimatedDays !== undefined && estimatedDays !== null) {
    serviceInsert.estimated_duration_days = Number(estimatedDays)
  }

  const { data: service, error: serviceError } = await supabase
    .from("service")
    .insert(serviceInsert)
    .select("service_id")
    .single()

  if (serviceError || !service) {
    return NextResponse.json(
      { error: serviceError?.message ?? "Failed to create service." },
      { status: 500 }
    )
  }

  // Insert stage templates if any
  if (stages && (stages as Stage[]).length > 0) {
    const stageRows = (stages as Stage[]).map((s) => ({
      service_id: service.service_id,
      stage_name: s.stage_name,
      stage_order: s.stage_order,
      vehicle_type_id: vehicleTypeId,
      is_active: true,
      requires_photo: false,
      requires_video: false,
    }))

    const { error: stageError } = await supabase
      .from("service_stage_template")
      .insert(stageRows)

    if (stageError) {
      // Rollback: delete the service row
      await supabase
        .from("service")
        .delete()
        .eq("service_id", service.service_id)

      return NextResponse.json(
        { error: stageError.message ?? "Failed to save workflow stages." },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ success: true, serviceId: service.service_id })
}
