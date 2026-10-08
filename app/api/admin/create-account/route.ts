import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { validateName } from "@/lib/name"
import { validateEmail, normalizeEmail } from "@/lib/email/validation"
import { sendAccountCreatedEmail } from "@/lib/email/mailer"
import { getRoleCaller } from "@/lib/auth/caller"

const ALLOWED_ROLES = [
  "admin",
  "operations",
  "sales",
  "head_detailer",
  "head_installer",
] as const

const CreateAccountSchema = z.object({
  firstName: z.string().trim().min(1, "First name required").max(50)
    .superRefine((v, ctx) => {
      const err = validateName(v, "First name")
      if (err) ctx.addIssue({ code: "custom", message: err })
    }),
  lastName: z.string().trim().min(1, "Last name required").max(50)
    .superRefine((v, ctx) => {
      const err = validateName(v, "Last name")
      if (err) ctx.addIssue({ code: "custom", message: err })
    }),
  email: z.string().trim().max(254)
    .superRefine((v, ctx) => {
      const err = validateEmail(v, "Email")
      if (err) ctx.addIssue({ code: "custom", message: err })
    }),
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(50)
    .regex(
      /^[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$/,
      "Username must contain a dot and may only contain letters, numbers, underscores, and one dot (e.g. first.last)."
    ),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.enum(ALLOWED_ROLES, { message: "Invalid role" }),
})

export async function POST(request: Request) {
  const auth = await getRoleCaller(["admin", "super_admin"])
  if ("error" in auth) return auth.error

  const body = await request.json()
  const parsed = CreateAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { firstName, lastName, email, username, password, role } = parsed.data
  const fullName = `${firstName} ${lastName}`
  const normalizedEmail = normalizeEmail(email)

  const cookieStore = await cookies()
  const userClient  = createClient(cookieStore)
  const { data: { user: caller } } = await userClient.auth.getUser()

  if (!caller) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: callerProfile } = await adminClient
    .from("user_account")
    .select("full_name, role")
    .eq("id", caller.id)
    .single()

  // Only super_admin can create admin accounts
  if (role === "admin" && callerProfile?.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only a Super Admin can create Admin accounts." },
      { status: 403 }
    )
  }

  const supabase = adminClient

  // Check username uniqueness
  const { data: existing } = await supabase
    .from("user_account")
    .select("id")
    .eq("username", username.trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Username is already taken." }, { status: 409 })
  }

  // Check contact-email uniqueness (case-insensitive) — a friendlier
  // pre-check ahead of the DB's own normalized unique index, same pattern
  // already used for service/category-preset names.
  const { data: existingAccounts } = await supabase.from("user_account").select("email")
  if ((existingAccounts ?? []).some((a) => a.email && normalizeEmail(a.email) === normalizedEmail)) {
    return NextResponse.json({ error: "That email is already in use by another account." }, { status: 409 })
  }

  // Internal email derived from username — the Supabase Auth sign-in
  // identity, kept separate from the real contact email above (which is
  // not a valid mailbox for auth purposes and isn't meant to be).
  const authEmail = `${username.toLowerCase().trim()}@826autocare.internal`

  // Create Supabase Auth user — handle_new_user trigger creates user_account row
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username:  username.trim(),
      full_name: fullName.trim(),
    },
  })

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Failed to create auth user." },
      { status: 500 }
    )
  }

  // Update role (trigger defaults role to 'sales') and ensure full_name is set
  const { error: profileError } = await supabase
    .from("user_account")
    .update({
      role,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName.trim(),
      email: normalizedEmail,
      must_change_password: true,
    })
    .eq("id", authData.user.id)

  if (profileError) {
    // Rollback auth user
    await supabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (callerProfile) {
    logAudit({
      user_id:   caller.id,
      user_name: callerProfile.full_name,
      role:      callerProfile.role,
      category:  "create",
      action:    "Created account",
      target:    fullName.trim(),
    })
  }

  // Best-effort — account creation has already succeeded and must not be
  // rolled back over a transient email-provider issue. The admin still sees
  // the password on screen either way.
  const emailResult = await sendAccountCreatedEmail(normalizedEmail, {
    fullName: fullName.trim(),
    username: username.trim(),
    password,
  })
  if (!emailResult.ok) {
    console.error("sendAccountCreatedEmail failed:", emailResult.error)
  }

  return NextResponse.json({ success: true, emailSent: emailResult.ok })
}
