import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { hashMfaCode, MAX_MFA_ATTEMPTS } from "@/lib/auth/mfa-challenge"
import { normalizeEmail } from "@/lib/email/validation"

// POST /api/auth/connect-email/confirm
// Body: { challengeId, code }. Only on a correct code does this actually
// write user_account.email — an abandoned or failed attempt never touches
// the account.
export async function POST(request: Request) {
  try {
    const { challengeId, code } = await request.json()
    if (!challengeId || !code) {
      return NextResponse.json({ error: "Verification code is required." }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: challenge } = await admin
      .from("email_verification_challenge")
      .select("id, user_id, email, code_hash, expires_at, used_at, attempt_count")
      .eq("id", challengeId)
      .single()

    // Must belong to the signed-in user — same defense as verify-mfa.
    if (!challenge || challenge.user_id !== user.id || challenge.used_at || new Date(challenge.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This verification code has expired. Please start again." },
        { status: 400 },
      )
    }

    if (challenge.attempt_count >= MAX_MFA_ATTEMPTS) {
      await admin.from("email_verification_challenge").update({ used_at: new Date().toISOString() }).eq("id", challenge.id)
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please start again." },
        { status: 400 },
      )
    }

    if (challenge.code_hash !== hashMfaCode(code)) {
      await admin
        .from("email_verification_challenge")
        .update({ attempt_count: challenge.attempt_count + 1 })
        .eq("id", challenge.id)
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 })
    }

    // Re-check uniqueness at the moment of saving — the window since /start
    // is short, but another account could theoretically have claimed this
    // email in between.
    const { data: otherAccounts } = await admin.from("user_account").select("email").neq("id", user.id)
    const cleanEmail = normalizeEmail(challenge.email)
    if ((otherAccounts ?? []).some((a) => a.email && normalizeEmail(a.email) === cleanEmail)) {
      return NextResponse.json({ error: "That email is already in use by another account." }, { status: 409 })
    }

    const { data: existing } = await admin.from("user_account").select("email").eq("id", user.id).single()
    const wasAlreadyConnected = !!existing?.email

    const { error: updateError } = await admin
      .from("user_account")
      .update({ email: cleanEmail })
      .eq("id", user.id)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await admin.from("email_verification_challenge").update({ used_at: new Date().toISOString() }).eq("id", challenge.id)

    const caller = await getAuditCaller()
    if (caller) {
      await logAuditCall(caller, {
        category: "auth",
        action:   wasAlreadyConnected ? "Updated contact email" : "Connected email for MFA",
        target:   cleanEmail,
      })
    }

    return NextResponse.json({ success: true, email: cleanEmail })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
