import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { validateName } from "@/lib/name"

const ALLOWED_ROLES = [
  "admin",
  "operations",
  "sales",
  "head_detailer",
  "head_installer",
] as const

const CreateAccountSchema = z.object({
  fullName: z.string().trim().min(1, "Full name required").max(100)
    .superRefine((v, ctx) => {
      const err = validateName(v, "Full name")
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
  const body = await request.json()
  const parsed = CreateAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { fullName, username, password, role } = parsed.data

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

  // Internal email derived from username
  const email = `${username.toLowerCase().trim()}@826autocare.internal`

  // Create Supabase Auth user — handle_new_user trigger creates user_account row
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
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
      full_name: fullName.trim(),
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

  return NextResponse.json({ success: true })
}
