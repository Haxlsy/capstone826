import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/admin/workflow-categories
// Returns all active workflow categories ordered by creation date.
export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("workflow_category")
      .select("id, name, technician_role, display_color")
      .eq("is_active", true)
      .order("created_at")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ categories: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/admin/workflow-categories
// Body: { name: string, technician_role: "detailer" | "installer", display_color?: string }
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
    const { name, technician_role, display_color } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required." }, { status: 400 })
    }
    if (technician_role !== "detailer" && technician_role !== "installer") {
      return NextResponse.json({ error: "technician_role must be 'detailer' or 'installer'." }, { status: 400 })
    }


    const { data, error } = await admin
      .from("workflow_category")
      .insert({
        name:            name.trim(),
        technician_role,
        display_color:   display_color ?? "blue",
      })
      .select("id, name, technician_role, display_color")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `A category named "${name.trim()}" already exists.` }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ category: data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
