import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET — list all technicians (detailers/installers) with availability
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("technician")
      .select("id, full_name, role, is_available, is_archived")
      .eq("is_archived", false)
      .order("role")
      .order("full_name")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ technicians: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

// PATCH — toggle a technician's availability
export async function PATCH(request: Request) {
  try {
    const { id, is_available } = await request.json()

    if (!id || typeof is_available !== "boolean") {
      return NextResponse.json({ error: "id and is_available (boolean) are required." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("technician")
      .update({ is_available })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST — create a new technician (detailer or installer)
export async function POST(request: Request) {
  try {
    const { full_name, role } = await request.json()

    if (!full_name?.trim()) {
      return NextResponse.json({ error: "full_name is required." }, { status: 400 })
    }
    if (role !== "detailer" && role !== "installer") {
      return NextResponse.json({ error: "role must be 'detailer' or 'installer'." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("technician")
      .insert({ full_name: full_name.trim(), role, is_available: true })
      .select("id, full_name, role, is_available")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ technician: data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
