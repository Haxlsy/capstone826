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

    const [{ count }, { data: affected }, { data: serviceIds }] = await Promise.all([
      admin.from("service").select("id", { count: "exact", head: true }).eq("service_type", decoded),
      admin.from("service").select("name").eq("service_type", decoded).limit(5),
      admin.from("service").select("id").eq("service_type", decoded),
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
          .select("id, status, customer_name, created_at")
          .in("service_id", svcIds)
          .in("status", LIVE)
          .limit(5)
        liveJobs = (liveJobRows ?? []).map((j) => {
          const year    = new Date(j.created_at).getFullYear()
          const shortId = (j.id as string).slice(-4).toUpperCase()
          return `JO-${year}-${shortId} (${j.customer_name}) — ${j.status}`
        })
      }

      return NextResponse.json(
        {
          error: liveJobs.length > 0
            ? "Cannot delete — this type is used by existing services and active job orders."
            : "Cannot delete — this type is used by existing services. Archive or reassign them first.",
          affectedServices,
          liveJobs,
        },
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
