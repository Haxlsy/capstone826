import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// DELETE /api/admin/workflow-categories/[id]
// Soft-deletes a workflow category (sets is_active = false).
// Rejects if any active service still references this category.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Guard: reject if any service_stage still references this category
    const { count: stageCount } = await admin
      .from("service_stage")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id)

    if ((stageCount ?? 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${stageCount} service stage(s) still use this category. Remove or reassign them first.` },
        { status: 409 }
      )
    }

    const { error } = await admin
      .from("workflow_category")
      .update({ is_active: false })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
