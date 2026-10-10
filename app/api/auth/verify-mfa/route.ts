import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashMfaCode, MAX_MFA_ATTEMPTS, createEmailChallenge } from "@/lib/auth/mfa-challenge"
import { completeLogin } from "@/lib/auth/complete-login"
import { logAudit } from "@/hooks/audit-helpers"
import { LOCKOUT_THRESHOLD } from "@/lib/auth/login-lockout"

// POST /api/auth/verify-mfa
// Body: { challengeId, code } to verify, or { challengeId, switchToEmail: true }
// to abandon a TOTP challenge and get a fresh email-code one instead. Only
// ever called after app/api/auth/login/route.ts has already verified the
// password and created a challenge — this route owns the second factor and,
// on success, hands off to completeLogin() to finish the session the
// original login route used to finish by itself.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { challengeId, code, switchToEmail } = body

    if (!challengeId) {
      return NextResponse.json({ error: "Missing challenge." }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: challenge } = await admin
      .from("login_mfa_challenge")
      .select("id, user_id, method, code_hash, factor_id, expires_at, used_at, attempt_count")
      .eq("id", challengeId)
      .single()

    if (!challenge || challenge.used_at || new Date(challenge.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This verification code has expired. Please log in again." },
        { status: 400 },
      )
    }

    // "Use email instead" — abandon this (presumably TOTP) challenge and
    // issue a fresh email-code one for the same account.
    if (switchToEmail) {
      const { data: account } = await admin
        .from("user_account")
        .select("full_name, email")
        .eq("id", challenge.user_id)
        .single()
      if (!account?.email) {
        return NextResponse.json(
          { error: "This account has no contact email on file for verification codes." },
          { status: 400 },
        )
      }
      await admin.from("login_mfa_challenge").update({ used_at: new Date().toISOString() }).eq("id", challenge.id)
      const next = await createEmailChallenge(admin, challenge.user_id, account.email, account.full_name)
      return NextResponse.json({ mfaRequired: true, method: next.method, challengeId: next.challengeId })
    }

    if (!code) {
      return NextResponse.json({ error: "Verification code is required." }, { status: 400 })
    }

    if (challenge.attempt_count >= MAX_MFA_ATTEMPTS) {
      await admin.from("login_mfa_challenge").update({ used_at: new Date().toISOString() }).eq("id", challenge.id)
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please log in again." },
        { status: 400 },
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

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
      const newAttemptCount = challenge.attempt_count + 1
      await admin
        .from("login_mfa_challenge")
        .update({ attempt_count: newAttemptCount })
        .eq("id", challenge.id)

      const { data: account } = await admin
        .from("user_account")
        .select("username, full_name, role")
        .eq("id", challenge.user_id)
        .single()

      if (account) {
        await logAudit({
          user_id:   challenge.user_id,
          user_name: account.full_name,
          role:      account.role,
          category:  "auth",
          action:    "Failed MFA code attempt",
          target:    `${account.username} — attempt ${newAttemptCount}/${MAX_MFA_ATTEMPTS}`,
        })
      }

      if (newAttemptCount >= MAX_MFA_ATTEMPTS) {
        await admin.from("login_mfa_challenge").update({ used_at: new Date().toISOString() }).eq("id", challenge.id)

        if (account) {
          // Exhausting a whole challenge immediately trips the same
          // account-level lockout a wrong password can — otherwise someone
          // who already has a leaked/correct password could just keep
          // re-logging in for an unlimited number of fresh 5-guess budgets
          // against the code.
          await admin.from("user_account").update({
            failed_login_count: LOCKOUT_THRESHOLD,
            failed_login_at:    new Date().toISOString(),
          }).eq("id", challenge.user_id)

          await logAudit({
            user_id:   challenge.user_id,
            user_name: account.full_name,
            role:      account.role,
            category:  "auth",
            action:    "Account locked out after too many failed MFA attempts",
            target:    account.username,
          })

          return NextResponse.json(
            { error: "Too many failed attempts. Please wait 1 minute.", retryAfterSeconds: 60 },
            { status: 423 },
          )
        }

        return NextResponse.json(
          { error: "Too many incorrect attempts. Please log in again." },
          { status: 400 },
        )
      }

      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 })
    }

    await admin.from("login_mfa_challenge").update({ used_at: new Date().toISOString() }).eq("id", challenge.id)

    return await completeLogin(admin, supabase, challenge.user_id)
  } catch (err: unknown) {
    console.error("verify-mfa route error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
