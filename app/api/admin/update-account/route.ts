import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { normalizeName, validateName } from "@/lib/name"
import { getRoleCaller } from "@/lib/auth/caller"

export async function POST(request: Request) {
  const auth = await getRoleCaller(["admin", "super_admin"])
  if ("error" in auth) return auth.error

  const body = await request.json()
  const { userId, firstName, lastName, password } = body

  if (!userId || !firstName || !lastName) {
    return NextResponse.json({ error: "userId, firstName and lastName are required." }, { status: 400 })
  }

  const cleanFirst = normalizeName(firstName)
  const cleanLast = normalizeName(lastName)
  const nameError = validateName(cleanFirst, "First name") ?? validateName(cleanLast, "Last name")
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 })
  }
  const cleanName = `${cleanFirst} ${cleanLast}`

  const cookieStore = await cookies()
  const userClient  = createClient(cookieStore)
  const { data: { user: caller } } = await userClient.auth.getUser()

  const admin = createAdminClient()

  // An archived account is frozen — the UI already disables Edit for it, but
  // this is the authoritative check (e.g. against a direct API call).
  const { data: target } = await admin
    .from("user_account")
    .select("is_archived")
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
  // endpoint only ever updates first_name/last_name/password, matching the
  // Edit Account form, which shows Role as a read-only field.
  const supabase = admin

  const { error: profileError } = await supabase
    .from("user_account")
    .update({ first_name: cleanFirst, last_name: cleanLast, full_name: cleanName })
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
