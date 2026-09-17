import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)

    // Capture identity before signing out
    const { data: { user } } = await supabase.auth.getUser()

    const response = NextResponse.json({ success: true })
    response.cookies.set("826_role", "", { maxAge: 0, path: "/" })
    response.cookies.set("826_session_token", "", { maxAge: 0, path: "/" })

    if (user) {
      // signOut(), the session-marker delete, and the audit log write are
      // all independent (none needs another's result) — only getUser() had
      // to come first, since everything here needs user.id. Still awaited,
      // not fire-and-forget: a background write here was previously observed
      // getting dropped once the function returns on serverless.
      const admin = createAdminClient()
      await Promise.all([
        supabase.auth.signOut(),
        // Not strictly required for security (the next login overwrites this
        // row regardless), but avoids a stale marker lingering after a clean
        // logout.
        admin.from("user_active_session").delete().eq("user_id", user.id),
        createAuditLogEntry(admin, user.id),
      ])
    } else {
      await supabase.auth.signOut()
    }

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

async function createAuditLogEntry(admin: any, userId: string) {
  try {
    const { data: profile, error: profileError } = await admin
      .from("user_account")
      .select("full_name, role")
      .eq("id", userId)
      .single()

    if (profileError || !profile) {
      console.warn(`Audit Log: Could not find profile for ${userId}`)
      return
    }

    const { error: insertError } = await admin.from("audit_log").insert({
      user_id:   userId,
      user_name: profile.full_name,
      role:      profile.role,
      category:  "auth",
      action:    "Logged out",
      target:    "",
    })

    if (insertError) throw insertError

  } catch (e) {
    console.error("Audit Log DB Failure:", e)
  }
}