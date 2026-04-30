import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit"

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
      .select("full_name, role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 })
    }

    // Guard: reject if any service_stage still references this category
    const [{ count: stageCount }, { data: category }, { data: affectedStages }, { data: stageIds }] = await Promise.all([
      admin.from("service_stage").select("id", { count: "exact", head: true }).eq("category_id", id),
      admin.from("workflow_category").select("name").eq("id", id).single(),
      admin.from("service_stage").select("service:service_id(name)").eq("category_id", id).limit(20),
      admin.from("service_stage").select("id").eq("category_id", id),
    ])

    if ((stageCount ?? 0) > 0) {
      const seen = new Set<string>()
      const affectedServices: string[] = []
      for (const row of (affectedStages ?? [])) {
        const svc = row.service
        const name = Array.isArray(svc)
          ? (svc[0] as { name: string } | undefined)?.name
          : (svc as { name: string } | null)?.name
        if (name && !seen.has(name)) { seen.add(name); affectedServices.push(name) }
      }

      // Also check for live job orders using these stages
      const LIVE = ["Pending", "Ongoing", "For Rework", "For Inspection", "For Release", "Delayed"]
      const ids   = (stageIds ?? []).map((s) => s.id as string)
      let liveJobs: string[] = []
      if (ids.length > 0) {
        const { data: progressRows } = await admin
          .from("job_stage_progress")
          .select("job_order_id")
          .in("service_stage_id", ids)
        const jobOrderIds = [...new Set((progressRows ?? []).map((p) => p.job_order_id as string).filter(Boolean))]
        if (jobOrderIds.length > 0) {
          const { data: liveJobRows } = await admin
            .from("job_order")
            .select("id, status, customer_name, created_at")
            .in("id", jobOrderIds)
            .in("status", LIVE)
            .limit(5)
          liveJobs = (liveJobRows ?? []).map((j) => {
            const year    = new Date(j.created_at).getFullYear()
            const shortId = (j.id as string).slice(-4).toUpperCase()
            return `JO-${year}-${shortId} (${j.customer_name}) — ${j.status}`
          })
        }
      }

      return NextResponse.json(
        {
          error: liveJobs.length > 0
            ? "Cannot delete — this category is used by existing services and active job orders."
            : "Cannot delete — this category is used by existing services. Remove or reassign the stages first.",
          affectedServices,
          liveJobs,
        },
        { status: 409 }
      )
    }

    const { error } = await admin
      .from("workflow_category")
      .update({ is_active: false })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logAudit({
      user_id:   user.id,
      user_name: profile.full_name,
      role:      profile.role,
      category:  "delete",
      action:    "Deleted workflow category",
      target:    category?.name ?? id,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
