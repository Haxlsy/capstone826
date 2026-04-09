import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const body = await request.json()
  const { fullName, username, password, role, contactNo } = body

  console.log("[create-account] Received request:", {
    fullName,
    username,
    role,
    contactNo,
    password: password ? "***" : "(empty)",
  })

  if (!fullName || !username || !password || !role || !contactNo) {
    console.log("[create-account] Validation failed — missing fields")
    return NextResponse.json({ error: "All fields are required." }, { status: 400 })
  }

  // Prevent technician role assignment (technician role is deprecated)
  const ALLOWED_ROLES = ["admin", "super_admin", "operations", "sales", "head_technician"]
  if (!ALLOWED_ROLES.includes(role)) {
    console.log("[create-account] Invalid role:", role)
    return NextResponse.json({ error: `Invalid role. Allowed roles: ${ALLOWED_ROLES.join(", ")}` }, { status: 400 })
  }

  // Only super_admin can create admin accounts
  if (role === "admin" || role === "super_admin") {
    const cookieStore = await cookies()
    const supabaseUser = createClient(cookieStore)
    const { data: { user: caller } } = await supabaseUser.auth.getUser()

    let callerRole = ""
    if (caller) {
      const { data: callerProfile } = await supabaseUser
        .from("profile")
        .select("role")
        .eq("user_id", caller.id)
        .single()
      callerRole = callerProfile?.role ?? ""
    }

    if (callerRole !== "super_admin") {
      return NextResponse.json({ error: "Only a Super Admin can assign the Admin role." }, { status: 403 })
    }
  }

  const supabase = createAdminClient()

  // Internal email derived from username
  const email = `${username.toLowerCase().trim()}@826autocare.internal`
  console.log("[create-account] Generated email:", email)

  // Check if username already exists in profile
  const { data: existing, error: lookupError } = await supabase
    .from("profile")
    .select("user_id")
    .eq("user_name", username.trim())
    .maybeSingle()

  if (lookupError) {
    console.error("[create-account] Username lookup error:", lookupError.message)
  }

  if (existing) {
    console.log("[create-account] Username already taken:", username)
    return NextResponse.json({ error: "Username is already taken." }, { status: 409 })
  }

  // Create the Supabase Auth user.
  // Pass user_metadata so the handle_new_user trigger creates the profile row
  // with the correct user_name, full_name, and contact_no automatically.
  console.log("[create-account] Creating auth user...")
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      user_name: username.trim(),
      full_name: fullName.trim(),
      contact_no: contactNo.trim(),
    },
  })

  if (authError || !authData.user) {
    console.error("[create-account] Auth user creation failed:", authError?.message)
    return NextResponse.json(
      { error: authError?.message ?? "Failed to create auth user." },
      { status: 500 }
    )
  }

  console.log("[create-account] Auth user created:", authData.user.id)

  // The handle_new_user trigger auto-inserted a profile row with user_name,
  // full_name, and contact_no from the metadata. Role defaults to 'technician'.
  // UPDATE here to set the actual role (and ensure all fields are correct).
  const { error: profileError } = await supabase
    .from("profile")
    .update({
      role,
      full_name: fullName.trim(),
      contact_no: contactNo.trim(),
    })
    .eq("user_id", authData.user.id)

  if (profileError) {
    console.error("[create-account] Profile update failed:", profileError.message)
    // Rollback: delete the auth user (cascade will remove the profile row too)
    await supabase.auth.admin.deleteUser(authData.user.id)
    console.log("[create-account] Rolled back auth user:", authData.user.id)
    return NextResponse.json(
      { error: profileError.message ?? "Failed to update profile." },
      { status: 500 }
    )
  }

  console.log("[create-account] Profile updated successfully for user:", authData.user.id)
  return NextResponse.json({ success: true })
}
