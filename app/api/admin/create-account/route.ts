import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const { fullName, username, password, role, contactNo } = await request.json()

  if (!fullName || !username || !password || !role || !contactNo) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Use a generated internal email: username@826autocare.internal
  const email = `${username.toLowerCase()}@826autocare.internal`

  // Check if username already exists in profile
  const { data: existing } = await supabase
    .from("profile")
    .select("user_id")
    .eq("user_name", username)
    .single()

  if (existing) {
    return NextResponse.json({ error: "Username is already taken." }, { status: 409 })
  }

  // Create the Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Failed to create auth user." },
      { status: 500 }
    )
  }

  // Insert the profile row
  const { error: profileError } = await supabase.from("profile").insert({
    user_id: authData.user.id,
    full_name: fullName,
    user_name: username,
    role,
    contact_no: contactNo,
    is_archived: false,
  })

  if (profileError) {
    // Rollback: delete the auth user if profile insert fails
    await supabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json(
      { error: profileError.message ?? "Failed to create profile." },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
