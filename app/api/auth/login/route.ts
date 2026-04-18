import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Resolve username → Supabase Auth email via DB function
  // Use admin client so the RPC can read user_account regardless of RLS
  const admin = createAdminClient()
  const { data: email, error: lookupError } = await admin
    .rpc("get_user_email_by_username", { p_username: username })

  if (lookupError || !email) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
  }

  // Sign in with Supabase Auth (uses the session client to set the cookie)
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !data.user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
  }

  // Fetch user_account profile via admin client (bypasses RLS)
  const { data: profile, error: profileError } = await admin
    .from("user_account")
    .select("username, full_name, role")
    .eq("id", data.user.id)
    .eq("is_archived", false)
    .single()

  if (profileError || !profile) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: "Access denied." }, { status: 403 })
  }

  // Log the login event (fire-and-forget — don't block the response)
  Promise.resolve(
    admin.from("audit_log").insert({
      user_id:   data.user.id,
      user_name: profile.full_name,
      role:      profile.role,
      category:  "auth",
      action:    "Logged in",
      target:    "",
    })
  ).catch(() => {})

  return NextResponse.json({ user: profile })
}
