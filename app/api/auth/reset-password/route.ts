import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { hashToken } from "@/lib/auth/token-hash"
import { completeLogin } from "@/lib/auth/complete-login"

// POST /api/auth/reset-password
// Body: { token, newPassword }
// Completes a forgot-password reset — the token came from the emailed link
// (app/api/auth/forgot-password/route.ts), never from an authenticated
// session, so there's no getAuditCaller() to lean on here.
export async function POST(request: Request) {
  try {
    const { token, newPassword } = await request.json()

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token and new password are required." }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: resetToken } = await admin
      .from("password_reset_token")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", hashToken(token))
      .maybeSingle()

    if (!resetToken || resetToken.used_at || new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 },
      )
    }

    const { data: account } = await admin
      .from("user_account")
      .select("username, full_name, role, is_archived")
      .eq("id", resetToken.user_id)
      .single()

    if (!account || account.is_archived) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 },
      )
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(resetToken.user_id, {
      password: newPassword,
    })
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await admin
      .from("password_reset_token")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetToken.id)

    await admin
      .from("user_account")
      .update({ must_change_password: false })
      .eq("id", resetToken.user_id)

    // Auto-login with the password just set, instead of sending the user
    // back to /login to type everything again — the reset link itself
    // (only usable by whoever has access to the account's email inbox)
    // already proves the same thing an email-MFA code would, so no separate
    // MFA step is added here.
    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    `${account.username.toLowerCase()}@826autocare.internal`,
      password: newPassword,
    })
    if (!signInError) {
      return completeLogin(admin, supabase, resetToken.user_id, "Reset own password via email link")
    }

    // Unexpected — the password was already changed successfully either
    // way, so don't fail the request over this. Fall back to the old
    // behavior; ResetPasswordPage.tsx shows its "Go to Login" screen.
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
