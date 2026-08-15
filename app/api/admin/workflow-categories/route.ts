import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminCaller } from "@/lib/auth/guard"
import { auditCallerOf } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"

// POST /api/admin/workflow-categories
// Find-or-create: if a category with the same name already exists, return it.
// Body: { name: string, technician_role: "detailer" | "installer", display_color?: string }
export async function POST(request: Request) {
  try {
    const auth = await getAdminCaller()
    if ("error" in auth) return auth.error
    const { caller } = auth

    const admin = createAdminClient()

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
      .upsert(
        { name: name.trim(), technician_role, display_color: display_color ?? "blue" },
        { onConflict: "name", ignoreDuplicates: false }
      )
      .select("id, name, technician_role, display_color")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logAuditCall(auditCallerOf(caller), {
      category: "create",
      action:   "Created or updated workflow category",
      target:   data.name,
    })

    return NextResponse.json({ category: data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
