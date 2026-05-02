import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Credentials required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const admin = createAdminClient()

    // 1. Resolve email via RPC
    const { data: email, error: lookupError } = await admin
      .rpc("get_user_email_by_username", { p_username: username })

    if (lookupError || !email) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // 2. Sign in
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !authData.user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // 3. Fetch Profile & Check Permissions
    const { data: profile, error: profileError } = await admin
      .from("user_account")
      .select("username, full_name, role")
      .eq("id", authData.user.id)
      .eq("is_archived", false)
      .single()

    if (profileError || !profile) {
      // Clean up the session if the profile check fails
      await supabase.auth.signOut()
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // 4. Log Event (Awaited for reliability in Serverless)
    await createAuditLog(admin, authData.user.id, profile, "Logged in")

    return NextResponse.json({ user: profile })

  } catch (err) {
    console.error("Login route error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Re-using a refined helper
async function createAuditLog(admin: any, userId: string, profile: any, action: string) {
  try {
    await admin.from("audit_log").insert({
      user_id:   userId,
      user_name: profile.full_name,
      role:      profile.role,
      category:  "auth",
      action:    action,
      target:    "",
    })
  } catch (e) {
    console.error("Failed to write audit log:", e)
  }
}
