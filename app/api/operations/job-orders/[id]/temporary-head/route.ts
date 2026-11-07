import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRoleCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { readJsonBody } from "@/lib/http/read-json-body"
import { sendPushToUser } from "@/lib/push/send"
import { substituteAddedMessage } from "@/lib/substitute-label"
import { isTechnicianAvailableToday } from "@/lib/technician-availability"
import { endOfManilaDay, headRoleForCrew, tempHeadUsername } from "@/lib/auth/temporary-access"

const BodySchema = z.object({
  technician_id: z.string().uuid(),
  role:          z.enum(["head_detailer", "head_installer"]),
  password:      z.string().min(8, "Temporary password must be at least 8 characters.").max(72),
})

const ROLE_LABEL = { head_detailer: "Head Detailer", head_installer: "Head Installer" } as const

// POST /api/operations/job-orders/[id]/temporary-head
// Body: { technician_id, role: "head_detailer" | "head_installer", password }
//
// When no head technician is available, Operations makes a technician who is
// present the TEMPORARY head for this job, for today only. Their login is
// created once and reused (technician.user_account_id); its access ends on its
// own at 11:59 PM Manila (user_account.access_expires_at, enforced wherever an
// archived account is blocked). No admin has to create or archive anything.
// The password is generated on Operations' screen so they can read it out.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error
    const { caller } = auth

    const { id: jobId } = await params
    const parsed = BodySchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { technician_id, role, password } = parsed.data

    const admin = createAdminClient()

    const { data: job } = await admin
      .from("job_order")
      .select("id, status, customer_name, job_order_code")
      .eq("id", jobId)
      .single<{ id: string; status: string; customer_name: string | null; job_order_code: string | null }>()
    if (!job) return NextResponse.json({ error: "Job order not found." }, { status: 404 })
    if (job.status === "Released" || job.status === "Cancelled") {
      return NextResponse.json({ error: `This job order is ${job.status.toLowerCase()}.` }, { status: 400 })
    }

    // "*": includes user_account_id once the temporary-head migration has run.
    const { data: tech, error: techError } = await admin
      .from("technician")
      .select("*")
      .eq("id", technician_id)
      .single()
    if (techError || !tech) return NextResponse.json({ error: "Technician not found." }, { status: 404 })
    if (!("user_account_id" in tech)) {
      return NextResponse.json(
        { error: "Temporary head technicians aren't set up yet. Ask an admin to run the latest database update." },
        { status: 500 },
      )
    }
    if (tech.is_archived) return NextResponse.json({ error: "This technician is archived." }, { status: 400 })
    if (headRoleForCrew(tech.role) !== role) {
      return NextResponse.json(
        { error: `${tech.full_name} is a ${tech.role}, so they can only be a temporary ${tech.role === "detailer" ? "Head Detailer" : "Head Installer"}.` },
        { status: 400 },
      )
    }
    if (!isTechnicianAvailableToday(tech)) {
      return NextResponse.json({ error: `${tech.full_name} isn't available today.` }, { status: 400 })
    }

    const expiresAt = endOfManilaDay().toISOString()
    const fullName = (tech.full_name as string).trim()
    const firstName = ((tech.first_name as string | null) ?? fullName.split(" ")[0] ?? "").trim()
    const lastName  = ((tech.last_name as string | null) ?? fullName.split(" ").slice(1).join(" ")).trim()

    let accountId = tech.user_account_id as string | null
    let username: string

    if (accountId) {
      // Reuse their login: fresh password, access until tonight.
      const { data: existing } = await admin
        .from("user_account")
        .select("*")
        .eq("id", accountId)
        .single()
      if (!existing) {
        accountId = null // link points at a deleted account; create a new one below
      } else if (existing.is_temporary_head !== true) {
        return NextResponse.json(
          { error: `${fullName} already has a regular head technician account. Pick them from the list above instead.` },
          { status: 409 },
        )
      } else {
        const { error: pwError } = await admin.auth.admin.updateUserById(accountId, { password })
        if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 })
        const { error: updError } = await admin
          .from("user_account")
          .update({
            role,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            is_archived: false,
            must_change_password: false,
            access_expires_at: expiresAt,
          })
          .eq("id", accountId)
        if (updError) return NextResponse.json({ error: updError.message }, { status: 500 })
        username = existing.username as string
      }
    }

    if (!accountId) {
      // First time: create their login (same internal sign-in email scheme as
      // app/api/admin/create-account), then link it to the technician.
      const { data: taken } = await admin.from("user_account").select("username")
      username = tempHeadUsername(firstName, lastName, (taken ?? []).map((u) => u.username as string))
      if (!username) {
        return NextResponse.json({ error: "This technician needs a first and last name first." }, { status: 400 })
      }
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: `${username}@826autocare.internal`,
        password,
        email_confirm: true,
        user_metadata: { username, full_name: fullName },
      })
      if (authError || !authData.user) {
        return NextResponse.json({ error: authError?.message ?? "Couldn't create the login." }, { status: 500 })
      }
      accountId = authData.user.id
      const [{ error: profileError }, { error: linkError }] = await Promise.all([
        admin
          .from("user_account")
          .update({
            role,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            email: null,
            must_change_password: false,
            is_temporary_head: true,
            access_expires_at: expiresAt,
          })
          .eq("id", accountId),
        admin.from("technician").update({ user_account_id: accountId }).eq("id", technician_id),
      ])
      if (profileError || linkError) {
        await admin.auth.admin.deleteUser(accountId) // roll back the half-made login
        return NextResponse.json({ error: (profileError ?? linkError)!.message }, { status: 500 })
      }
    }

    // Add them to the job as a substitute head (nobody is removed).
    const { data: already } = await admin
      .from("job_order_team")
      .select("id")
      .eq("job_order_id", jobId)
      .eq("role_in_job", role)
      .eq("user_account_id", accountId!)
      .maybeSingle()
    if (!already) {
      const { error: teamError } = await admin.from("job_order_team").insert({
        job_order_id: jobId,
        user_account_id: accountId,
        role_in_job: role,
        is_substitute: true,
      })
      if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 })
    }

    const jobLabel = job.job_order_code ?? job.customer_name ?? jobId

    // Bell + push for the temporary head, same as any substitute head.
    try {
      const message = substituteAddedMessage(role, jobLabel)
      await admin.from("notification").insert({
        user_id: accountId, type: "job_assigned", message, job_order_id: jobId, is_read: false,
      })
      await sendPushToUser(accountId!, { title: "Added as temporary head", body: message, url: `/head-technician/${jobId}` })
    } catch (err) {
      console.error("[temporary-head] notification failed:", err)
    }

    // The record Admin reviews (Security & Audit Center).
    await logAuditCall(caller, {
      category: "update",
      action:   `Made ${fullName} Temporary ${ROLE_LABEL[role]} (access until 11:59 PM)`,
      target:   jobLabel,
    })

    return NextResponse.json({ success: true, username: username!, password, full_name: fullName, expires_at: expiresAt })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
