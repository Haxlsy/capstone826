import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

interface Stage {
  stage_name: string
  stage_order: number
}

export async function POST(request: Request) {
  const body = await request.json()
  const { serviceName, description, price, estimatedDays, stages } = body

  console.log("[create-service] Received request:", {
    serviceName,
    description,
    price,
    estimatedDays,
    stageCount: Array.isArray(stages) ? stages.length : 0,
    stages,
  })

  if (!serviceName || price === undefined || price === null) {
    console.log("[create-service] Validation failed — missing serviceName or price")
    return NextResponse.json(
      { error: "Service name and price are required." },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get the first active vehicle type to satisfy the FK on service_stage_template
  const { data: vehicleType, error: vehicleTypeError } = await supabase
    .from("vehicle_type")
    .select("vehicle_type_id")
    .eq("is_active", true)
    .order("vehicle_type_id", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (vehicleTypeError) {
    console.error("[create-service] Vehicle type lookup error:", vehicleTypeError.message)
  }

  const vehicleTypeId = vehicleType?.vehicle_type_id ?? 1
  console.log("[create-service] Using vehicle_type_id:", vehicleTypeId)

  // Build the service insert object
  const serviceInsert: Record<string, unknown> = {
    service_name: serviceName.trim(),
    description: description?.trim() || null,
    price: Number(price),
    is_archived: false,
  }

  // estimated_duration_days column — included when provided
  if (estimatedDays !== undefined && estimatedDays !== null && estimatedDays !== "") {
    serviceInsert.estimated_duration_days = Number(estimatedDays)
  }

  console.log("[create-service] Inserting service row:", serviceInsert)

  const { data: service, error: serviceError } = await supabase
    .from("service")
    .insert(serviceInsert)
    .select("service_id")
    .single()

  if (serviceError || !service) {
    console.error("[create-service] Service insert failed:", serviceError?.message)
    return NextResponse.json(
      { error: serviceError?.message ?? "Failed to create service." },
      { status: 500 }
    )
  }

  console.log("[create-service] Service created with id:", service.service_id)

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

    console.log("[create-service] Inserting stage rows:", stageRows)

    const { error: stageError } = await supabase
      .from("service_stage_template")
      .insert(stageRows)

    if (stageError) {
      console.error("[create-service] Stage insert failed:", stageError.message)
      // Rollback: delete the service row
      await supabase
        .from("service")
        .delete()
        .eq("service_id", service.service_id)
      console.log("[create-service] Rolled back service:", service.service_id)
      return NextResponse.json(
        { error: stageError.message ?? "Failed to save workflow stages." },
        { status: 500 }
      )
    }

    console.log("[create-service] Stages inserted successfully")
  }

  console.log("[create-service] Done — serviceId:", service.service_id)
  return NextResponse.json({ success: true, serviceId: service.service_id })
}
