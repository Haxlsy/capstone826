import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit"

// DELETE /api/admin/service-types/[type]
// Rejects if any service (including archived) still uses this type.
// When no services use it the type is already absent from the derived list, so we just return success.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params
    const decoded  = decodeURIComponent(type)

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("user_account")
      .select("full_name, role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 })
    }

    const { count } = await admin
      .from("service")
      .select("id", { count: "exact", head: true })
      .eq("service_type", decoded)

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${count} service(s) still use this type. Archive or reassign them first.` },
        { status: 409 }
      )
    }

    logAudit({
      user_id:   user.id,
      user_name: profile.full_name,
      role:      profile.role,
      category:  "delete",
      action:    "Deleted service type",
      target:    decoded,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
