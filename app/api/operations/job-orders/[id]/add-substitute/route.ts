import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { z } from "zod"
import { sendPushToUser } from "@/lib/push/send"
import { substituteAddedMessage, type HeadRole } from "@/lib/substitute-label"
import { getRoleCaller } from "@/lib/auth/caller"

const BodySchema = z.object({
  person_id: z.string().uuid(),
  role:      z.enum(["detailer", "installer", "head_detailer", "head_installer"]),
})

const HEAD_ROLES = ["head_detailer", "head_installer"] as const

// POST /api/operations/job-orders/[id]/add-substitute
// Body: { person_id: string, role: "detailer" | "installer" | "head_detailer" | "head_installer" }
// Adds a substitute team member to the job without touching existing assignments.
// Crew roles resolve `person_id` against `technician`; head roles against `user_account`.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const { id: jobId } = await params
    const body   = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { person_id, role } = parsed.data
    const isHead = (HEAD_ROLES as readonly string[]).includes(role)

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // Verify job exists
    const { data: job } = await admin
      .from("job_order")
      .select("id, status, customer_name, job_order_code")
      .eq("id", jobId)
      .single<{ id: string; status: string; customer_name: string | null; job_order_code: string | null }>()
    if (!job) return NextResponse.json({ error: "Job order not found." }, { status: 404 })

    // Resolve + verify the person, and the job_order_team column to write.
    let personName: string
    let teamRow: Record<string, unknown>

    if (isHead) {
      const { data: head } = await admin
        .from("user_account")
        .select("id, full_name, role, is_archived")
        .eq("id", person_id)
        .single()
      if (!head) return NextResponse.json({ error: "Head technician not found." }, { status: 404 })
      if (head.is_archived) return NextResponse.json({ error: "Head technician is archived." }, { status: 400 })
      if (head.role !== role) {
        return NextResponse.json({ error: `That account is not a ${role.replace("_", " ")}.` }, { status: 400 })
      }
      personName = head.full_name
      teamRow = { job_order_id: jobId, user_account_id: person_id, role_in_job: role, is_substitute: true }
    } else {
      const { data: tech } = await admin
        .from("technician")
        .select("id, full_name, role, is_available, is_archived")
        .eq("id", person_id)
        .single()
      if (!tech) return NextResponse.json({ error: "Technician not found." }, { status: 404 })
      if (tech.is_archived) return NextResponse.json({ error: "Technician is archived." }, { status: 400 })
      personName = tech.full_name
      teamRow = { job_order_id: jobId, technician_id: person_id, role_in_job: role, is_substitute: true }
    }

    // Don't stack duplicates — same person, same role, same job.
    const idColumn = isHead ? "user_account_id" : "technician_id"
    const { data: existing } = await admin
      .from("job_order_team")
      .select("id")
      .eq("job_order_id", jobId)
      .eq("role_in_job", role)
      .eq(idColumn, person_id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: `${personName} is already on this job as a ${role.replace("_", " ")}.` }, { status: 400 })
    }

    await admin.from("job_order_team").insert(teamRow)

    // A substitute head technician has an account, so tell them (bell + push);
    // crew technicians have no login, nothing to notify. Best-effort: a
    // notification failure must not fail the add.
    if (isHead) {
      try {
        const message = substituteAddedMessage(role as HeadRole, job.job_order_code ?? job.customer_name ?? jobId)
        await admin.from("notification").insert({
          user_id:      person_id,
          type:         "job_assigned",
          message,
          job_order_id: jobId,
          is_read:      false,
        })
        await sendPushToUser(person_id, {
          title: "Added as substitute",
          body:  message,
          url:   `/head-technician/${jobId}`,
        })
      } catch (notifErr) {
        console.error("[add-substitute] notification failed:", notifErr)
      }
    }

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
        action:    `Added substitute ${role.replace("_", " ")} "${personName}" to job`,
        target:    job.customer_name ?? jobId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/operations/job-orders/[id]/add-substitute
// Body: { person_id: string, role: "detailer" | "installer" | "head_detailer" | "head_installer" }
// Removes a previously-added substitute — for the case a substitute was
// added by mistake. `is_substitute = true` is a hard guard, not just a
// filter: it makes it structurally impossible for this route to ever delete
// an original assignment, even given a wrong person_id/role — only a row
// this same route's POST created can match.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const { id: jobId } = await params
    const body   = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { person_id, role } = parsed.data
    const isHead = (HEAD_ROLES as readonly string[]).includes(role)
    const idColumn = isHead ? "user_account_id" : "technician_id"

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    const { data: job } = await admin
      .from("job_order")
      .select("id, customer_name")
      .eq("id", jobId)
      .single<{ id: string; customer_name: string | null }>()
    if (!job) return NextResponse.json({ error: "Job order not found." }, { status: 404 })

    const { data: existing } = await admin
      .from("job_order_team")
      .select("id, user_account_id, technician_id")
      .eq("job_order_id", jobId)
      .eq("role_in_job", role)
      .eq("is_substitute", true)
      .eq(idColumn, person_id)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json(
        { error: "That substitute could not be found — it may have already been removed." },
        { status: 404 },
      )
    }

    let personName = "Substitute"
    if (isHead) {
      const { data: head } = await admin.from("user_account").select("full_name").eq("id", person_id).single()
      personName = head?.full_name ?? personName
    } else {
      const { data: tech } = await admin.from("technician").select("full_name").eq("id", person_id).single()
      personName = tech?.full_name ?? personName
    }

    const { error: deleteError } = await admin
      .from("job_order_team")
      .delete()
      .eq("id", existing.id)
      .eq("is_substitute", true) // defense in depth even though `existing` was already filtered on it
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

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
        action:    `Removed substitute ${role.replace("_", " ")} "${personName}" from job`,
        target:    job.customer_name ?? jobId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
