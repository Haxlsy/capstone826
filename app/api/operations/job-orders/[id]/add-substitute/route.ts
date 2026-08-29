import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { z } from "zod"

const BodySchema = z.object({
  technician_id: z.string().uuid(),
  role:          z.enum(["detailer", "installer"]),
})

// POST /api/operations/job-orders/[id]/add-substitute
// Body: { technician_id: string, role: "detailer" | "installer" }
// Adds a substitute crew member to the job team without touching existing assignments.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const body   = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { technician_id, role } = parsed.data

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // Verify job exists
    const { data: job } = await admin
      .from("job_order")
      .select("id, status, customer_name")
      .eq("id", jobId)
      .single()
    if (!job) return NextResponse.json({ error: "Job order not found." }, { status: 404 })

    // Verify technician exists and is available
    const { data: tech } = await admin
      .from("technician")
      .select("id, full_name, role, is_available, is_archived")
      .eq("id", technician_id)
      .single()
    if (!tech) return NextResponse.json({ error: "Technician not found." }, { status: 404 })
    if (tech.is_archived) return NextResponse.json({ error: "Technician is archived." }, { status: 400 })

    await admin.from("job_order_team").insert({
      job_order_id:  jobId,
      technician_id,
      role_in_job:   role,
    })

    const { data: profile } = await admin
      .from("user_account")
      .select("full_name, role")
      .eq("id", user.id)
      .single()

    if (profile) {
      logAudit({
        user_id:   user.id,
        user_name: profile.full_name,
        role:      profile.role,
        category:  "update",
        action:    `Added substitute ${role} "${tech.full_name}" to job`,
        target:    (job as any).customer_name ?? jobId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
