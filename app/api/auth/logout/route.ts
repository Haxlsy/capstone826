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

    await supabase.auth.signOut()

    const response = NextResponse.json({ success: true })
    response.cookies.set("826_role", "", { maxAge: 0, path: "/" })

    // Log the logout event after sign-out (fire-and-forget)
    if (user) {
      const admin = createAdminClient()
      await createAuditLogEntry(admin, user.id);
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