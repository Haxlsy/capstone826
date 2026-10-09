import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { hashMfaCode, MAX_MFA_ATTEMPTS, createEmailChallenge, createTotpChallenge } from "@/lib/auth/mfa-challenge"

type AdminClient = ReturnType<typeof createAdminClient>

/** Actually changes the password — shared by the MFA-verified path and the
 *  no-verification-method-available fallback below. */
async function performPasswordChange(
  admin: AdminClient,
  userId: string,
  newPassword: string,
  auditAction: string = "Changed own password",
): Promise<NextResponse> {
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { error: flagError } = await admin
    .from("user_account")
    .update({ must_change_password: false })
    .eq("id", userId)
  if (flagError) {
    console.error("[change-password] failed to clear must_change_password:", flagError)
  }

  const caller = await getAuditCaller()
  if (caller) {
    await logAuditCall(caller, { category: "auth", action: auditAction })
  }

  return NextResponse.json({ success: true })
}

// POST /api/auth/change-password
// Two phases of the same endpoint, distinguished by whether `challengeId` is
// present:
//   Phase 1 — body: { currentPassword, newPassword }. Verifies the current
//     password, then creates an MFA challenge and responds with
//     { mfaRequired: true, method, challengeId } instead of changing
//     anything yet.
//   Phase 2 — body: { challengeId, code, newPassword }. Verifies the code,
//     then actually changes the password. `newPassword` is resent rather
//     than remembered server-side between phases — nothing sensitive is
//     persisted beyond the challenge itself.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { currentPassword, newPassword, challengeId, code } = body

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const admin = createAdminClient()

    // ── Phase 2: an MFA challenge already exists — verify it, then change. ──
    if (challengeId) {
      if (!code) {
        return NextResponse.json({ error: "Verification code is required." }, { status: 400 })
      }

      const { data: challenge } = await admin
        .from("login_mfa_challenge")
        .select("id, user_id, method, code_hash, factor_id, expires_at, used_at, attempt_count")
        .eq("id", challengeId)
        .single()

      // Must belong to the signed-in user — a challenge id for a different
      // account must never be usable here, even if somehow guessed.
      if (!challenge || challenge.user_id !== user.id || challenge.used_at || new Date(challenge.expires_at) < new Date()) {
        return NextResponse.json(
          { error: "This verification code has expired. Please start again." },
          { status: 400 },
        )
      }

      if (challenge.attempt_count >= MAX_MFA_ATTEMPTS) {
        await admin.from("login_mfa_challenge").update({ used_at: new Date().toISOString() }).eq("id", challenge.id)
        return NextResponse.json(
          { error: "Too many incorrect attempts. Please start again." },
          { status: 400 },
        )
      }

      let verified: boolean
      if (challenge.method === "totp") {
        if (!challenge.factor_id) {
          return NextResponse.json({ error: "Invalid challenge." }, { status: 400 })
        }
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: challenge.factor_id,
          code,
        })
        verified = !verifyError
      } else {
        verified = challenge.code_hash === hashMfaCode(code)
      }

      if (!verified) {
        await admin
          .from("login_mfa_challenge")
          .update({ attempt_count: challenge.attempt_count + 1 })
          .eq("id", challenge.id)
        return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 })
      }

      await admin.from("login_mfa_challenge").update({ used_at: new Date().toISOString() }).eq("id", challenge.id)

      return performPasswordChange(admin, user.id, newPassword)
    }

    // ── Phase 1: verify the current password, then issue a challenge. ──
    if (!currentPassword) {
      return NextResponse.json({ error: "Current and new password are required." }, { status: 400 })
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

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "New password must be different from your current password." },
        { status: 400 },
      )
    }

    const { data: account } = await admin
      .from("user_account")
      .select("full_name, email")
      .eq("id", user.id)
      .single()

    const { data: factorData } = await supabase.auth.mfa.listFactors()
    const totpFactor = factorData?.totp?.[0]

    if (totpFactor) {
      const { challengeId: id, method } = await createTotpChallenge(admin, user.id, totpFactor.id)
      return NextResponse.json({ mfaRequired: true, method, challengeId: id })
    }

    if (!account?.email) {
      // No TOTP factor and no contact email to verify with — same reasoning
      // as the login route's identical fallback: MFA can't be enforced on a
      // channel that doesn't exist, so proceed with the change directly
      // rather than permanently blocking it. Current password was already
      // verified above, so this isn't skipping authentication, only the
      // extra factor. Logged explicitly for visibility.
      return performPasswordChange(
        admin,
        user.id,
        newPassword,
        "Changed own password without MFA — no verification method on file",
      )
    }

    const { challengeId: id, method, emailSent } = await createEmailChallenge(admin, user.id, account.email, account.full_name)
    if (!emailSent) {
      await admin.from("login_mfa_challenge").update({ used_at: new Date().toISOString() }).eq("id", id)
      return NextResponse.json(
        { error: "We couldn't send your verification code right now. Please try again shortly or contact an admin." },
        { status: 500 },
      )
    }
    return NextResponse.json({ mfaRequired: true, method, challengeId: id })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
