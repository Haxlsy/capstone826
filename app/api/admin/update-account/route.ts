import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { normalizeName, validateName } from "@/lib/name"
import { normalizeEmail, validateEmail } from "@/lib/email/validation"
import { sendEmailChangedOldAddressEmail, sendEmailChangedNewAddressEmail } from "@/lib/email/mailer"
import { getRoleCaller } from "@/lib/auth/caller"

export async function POST(request: Request) {
  const auth = await getRoleCaller(["admin", "super_admin"])
  if ("error" in auth) return auth.error

  const body = await request.json()
  const { userId, firstName, lastName, email, password } = body

  if (!userId || !firstName || !lastName || !email) {
    return NextResponse.json({ error: "userId, firstName, lastName and email are required." }, { status: 400 })
  }

  const cleanFirst = normalizeName(firstName)
  const cleanLast = normalizeName(lastName)
  const nameError = validateName(cleanFirst, "First name") ?? validateName(cleanLast, "Last name")
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 })
  }
  const cleanName = `${cleanFirst} ${cleanLast}`

  const cleanEmail = normalizeEmail(email)
  const emailError = validateEmail(cleanEmail, "Email")
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 400 })
  }

  const cookieStore = await cookies()
  const userClient  = createClient(cookieStore)
  const { data: { user: caller } } = await userClient.auth.getUser()

  const admin = createAdminClient()

  // An archived account is frozen — the UI already disables Edit for it, but
  // this is the authoritative check (e.g. against a direct API call).
  const { data: target } = await admin
    .from("user_account")
    .select("is_archived, email, full_name, username")
    .eq("id", userId)
    .single()
  if (target?.is_archived) {
    return NextResponse.json(
      { error: "This account is archived and can't be edited. Restore it first." },
      { status: 409 },
    )
  }

  // Role is fixed at creation (see create-account, which already gates the
  // Admin role to Super Admin) and intentionally NOT accepted here — this
  // endpoint only ever updates first_name/last_name/email/password, matching
  // the Edit Account form, which shows Role as a read-only field.
  const supabase = admin

  // Contact-email uniqueness (case-insensitive), scoped to exclude this
  // account's own current row so saving it unchanged doesn't false-positive —
  // same pattern already used for service/category-preset name edits.
  const { data: otherAccounts } = await supabase.from("user_account").select("email").neq("id", userId)
  if ((otherAccounts ?? []).some((a) => a.email && normalizeEmail(a.email) === cleanEmail)) {
    return NextResponse.json({ error: "That email is already in use by another account." }, { status: 409 })
  }

  const { error: profileError } = await supabase
    .from("user_account")
    .update({ first_name: cleanFirst, last_name: cleanLast, full_name: cleanName, email: cleanEmail })
    .eq("id", userId)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (password) {
    const { error: pwError } = await supabase.auth.admin.updateUserById(userId, { password })
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 500 })
    }
  }

  // Heads-up emails for an admin-initiated email change — only when the
  // email actually changed, since the form always submits one even when the
  // admin only edited the name. Best-effort: the account update above is
  // already committed, so a failed send here must never affect the response.
  const oldEmail = target?.email ? normalizeEmail(target.email) : null
  if (target && oldEmail !== cleanEmail) {
    if (target.email) {
      const oldResult = await sendEmailChangedOldAddressEmail(target.email, { fullName: cleanName, username: target.username })
      if (!oldResult.ok) console.error("sendEmailChangedOldAddressEmail failed:", oldResult.error)
    }
    const newResult = await sendEmailChangedNewAddressEmail(cleanEmail, { fullName: cleanName, username: target.username })
    if (!newResult.ok) console.error("sendEmailChangedNewAddressEmail failed:", newResult.error)
  }

  if (caller) {
    const { data: callerProf } = await admin
      .from("user_account")
      .select("full_name, role")
      .eq("id", caller.id)
      .single()
    if (callerProf) {
      logAudit({
        user_id:   caller.id,
        user_name: callerProf.full_name,
        role:      callerProf.role,
        category:  "update",
        action:    "Updated account",
        target:    cleanName,
      })
    }
  }

  return NextResponse.json({ success: true })
}
