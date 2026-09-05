import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"

export async function POST(request: Request) {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required." }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)

    // Get current user from their session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    // Verify current password using a throwaway admin client. signInWithPassword
    // establishes an in-memory session on whatever client calls it, and once a
    // client has a session, its .from() calls use that session's token instead
    // of the service-role key — so this client must never be reused afterward
    // for privileged writes (it would silently fail under RLS).
    const verifyClient = createAdminClient()
    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
      email:    user.email!,
      password: currentPassword,
    })

    if (verifyError) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 })
    }

    // Fresh, untouched client — guaranteed to still use the service-role key.
    const admin = createAdminClient()

    // Update password
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const { error: flagError } = await admin
      .from("user_account")
      .update({ must_change_password: false })
      .eq("id", user.id)

    if (flagError) {
      console.error("[change-password] failed to clear must_change_password:", flagError)
    }

    const caller = await getAuditCaller()
    if (caller) {
      logAuditCall(caller, {
        category: "auth",
        action:   "Changed own password",
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
