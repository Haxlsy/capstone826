import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { getRoleCaller } from "@/lib/auth/caller"

async function requireAdminProfile() {
  const cookieStore = await cookies()
  const supabase    = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) } as const

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_account")
    .select("full_name, role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 }) } as const
  }
  return { user, profile, admin } as const
}

// PATCH /api/admin/service-types/[type]
// Renames a service type. `service.service_type` is a free-text column (not
// a foreign key — see supabase/migrations/20260423000001_add_service_type.sql),
// so every service currently carrying the old name is updated FIRST, then the
// service_type lookup row itself is renamed — if the second step somehow
// fails, services already show the new name rather than referencing a name
// that silently stopped existing in the lookup table.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const auth = await requireAdminProfile()
    if ("error" in auth) return auth.error
    const { user, profile, admin } = auth

    const { type } = await params
    const decoded = decodeURIComponent(type)

    const body = await request.json()
    const newName = typeof body?.name === "string" ? body.name.trim() : ""
    if (!newName) return NextResponse.json({ error: "Name is required." }, { status: 400 })
    if (newName === decoded) return NextResponse.json({ success: true, name: newName })

    const { error: svcErr } = await admin
      .from("service")
      .update({ service_type: newName })
      .eq("service_type", decoded)
    if (svcErr) return NextResponse.json({ error: svcErr.message }, { status: 500 })

    const { error: renameErr } = await admin
      .from("service_type")
      .update({ name: newName })
      .eq("name", decoded)

    if (renameErr) {
      if (renameErr.code === "23505") {
        return NextResponse.json(
          { error: `A service type similar to "${newName}" already exists.` },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: renameErr.message }, { status: 500 })
    }

    logAudit({
      user_id:   user.id,
      user_name: profile.full_name,
      role:      profile.role,
      category:  "update",
      action:    "Renamed service type",
      target:    `${decoded} → ${newName}`,
    })

    return NextResponse.json({ success: true, name: newName })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/admin/service-types/[type]
// Rejects if any service (including archived) still uses this type.
// When no services use it the type is already absent from the derived list, so we just return success.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const auth = await getRoleCaller(["admin", "super_admin"])
    if ("error" in auth) return auth.error

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

    const [{ count }, { data: affected }, { data: serviceIds }] = await Promise.all([
      admin.from("service").select("id", { count: "exact", head: true }).eq("service_type", decoded).eq("is_archived", false),
      admin.from("service").select("name").eq("service_type", decoded).eq("is_archived", false).limit(5),
      admin.from("service").select("id").eq("service_type", decoded).eq("is_archived", false),
    ])

    if ((count ?? 0) > 0) {
      const affectedServices = (affected ?? []).map((s: { name: string }) => s.name)

      // Check for live job orders using services of this type
      const LIVE = ["Pending", "Ongoing", "For Rework", "For Inspection", "For Release", "Delayed"]
      const svcIds = (serviceIds ?? []).map((s) => s.id as string)
      let liveJobs: string[] = []
      if (svcIds.length > 0) {
        const { data: liveJobRows } = await admin
          .from("job_order")
          .select("id, status, customer_name, job_order_code")
          .in("service_id", svcIds)
          .in("status", LIVE)
          .limit(5)
        liveJobs = (liveJobRows ?? []).map((j) => `${j.job_order_code} (${j.customer_name}) — ${j.status}`)
      }

      return NextResponse.json(
        {
          error: liveJobs.length > 0
            ? "Cannot delete — this type has active job orders in progress."
            : "Cannot delete — this type is used by active services. Archive them first.",
          affectedServices,
          liveJobs,
        },
        { status: 409 }
      )
    }

    // Remove from the service_type lookup table
    await admin.from("service_type").delete().eq("name", decoded)

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
