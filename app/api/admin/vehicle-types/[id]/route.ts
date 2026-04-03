import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!id) return NextResponse.json({ error: "Invalid id." }, { status: 400 })

  const body = await request.json()
  const { type_name, description, is_active } = body

  const updates: Record<string, any> = {}
  if (type_name !== undefined) updates.type_name = type_name.trim()
  if (description !== undefined) updates.description = description?.trim() || null
  if (is_active !== undefined) updates.is_active = is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 })
  }

  console.log("[/api/admin/vehicle-types/:id] PATCH", id, updates)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("vehicle_type")
    .update(updates)
    .eq("vehicle_type_id", id)
    .select("vehicle_type_id, type_name, description, is_active")
    .single()

  if (error) {
    console.error("[/api/admin/vehicle-types/:id] update error:", error.message)
    const msg = error.message.includes("unique") ? "A vehicle type with that name already exists." : error.message
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ vehicle_type: data })
}
