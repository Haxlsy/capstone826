import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  console.log("[/api/admin/vehicle-types] GET")
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("vehicle_type")
    .select("vehicle_type_id, type_name, description, is_active")
    .order("type_name")

  if (error) {
    console.error("[/api/admin/vehicle-types] query error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ vehicle_types: data ?? [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { type_name, description } = body

  if (!type_name?.trim()) {
    return NextResponse.json({ error: "Type name is required." }, { status: 400 })
  }

  console.log("[/api/admin/vehicle-types] POST", { type_name })
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("vehicle_type")
    .insert({ type_name: type_name.trim(), description: description?.trim() || null, is_active: true })
    .select("vehicle_type_id, type_name, description, is_active")
    .single()

  if (error) {
    console.error("[/api/admin/vehicle-types] insert error:", error.message)
    const msg = error.message.includes("unique") ? "A vehicle type with that name already exists." : error.message
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ vehicle_type: data })
}
