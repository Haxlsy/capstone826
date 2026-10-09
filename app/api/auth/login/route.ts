import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { verifyTurnstileToken } from "@/lib/auth/turnstile"
import { createEmailChallenge, createTotpChallenge } from "@/lib/auth/mfa-challenge"
import { completeLogin } from "@/lib/auth/complete-login"

const LoginSchema = z.object({
  username: z.string().trim().min(1, "Username required").max(100),
  password: z.string().min(1, "Password required").max(128),
  captchaToken: z.string().optional(),
})

const LOCKOUT_THRESHOLD = 3
const LOCKOUT_MS = 60_000

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { username, password, captchaToken } = parsed.data

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const admin = createAdminClient()

    // 1. Resolve email via RPC, alongside the account row this lockout logic
    // needs (id/role/name + the failed-attempt counters) — both keyed off
    // username, run in parallel so this doesn't add a round-trip.
    const [{ data: email, error: lookupError }, { data: account, error: acctError }] = await Promise.all([
      admin.rpc("get_user_email_by_username", { p_username: username }),
      admin
        .from("user_account")
        .select("id, full_name, role, email, must_change_password, failed_login_count, failed_login_at, is_archived")
        .eq("username", username)
        .single(),
    ])

    if (lookupError || !email || acctError || !account) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Server-authoritative lockout check — independent of whatever the
    // client's own (bypassable) counter thinks, so this holds even against a
    // direct API call. See supabase/migrations/20260917000003_user_account_failed_login_tracking.sql.
    const failedAt = account.failed_login_at ? new Date(account.failed_login_at).getTime() : null
    const stillLocked = account.failed_login_count >= LOCKOUT_THRESHOLD
      && failedAt !== null && Date.now() - failedAt < LOCKOUT_MS

    if (stillLocked) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please wait 1 minute.", retryAfterSeconds: 60 },
        { status: 423 }
      )
    }

    // Once an account has tripped the lockout once, every subsequent attempt
    // requires a passed CAPTCHA first — persists until a successful login
    // resets failed_login_count to 0 (step 4-7 below), covering every future
    // lockout cycle, not just the one right after the first. Checked before
    // ever attempting the password: a missing/failed CAPTCHA isn't a password
    // guess, so it must never touch the failed-attempt counter.
    const requiresCaptcha = account.failed_login_count >= LOCKOUT_THRESHOLD
    if (requiresCaptcha) {
      const passed = !!captchaToken && (await verifyTurnstileToken(captchaToken, request.headers.get("x-forwarded-for") ?? undefined))
      if (!passed) {
        return NextResponse.json(
          { error: "Please complete the verification challenge.", requireCaptcha: true },
          { status: 400 }
        )
      }
    }

    // 2. Sign in. This intentionally only establishes Supabase's own session
    // (aal1) — our app's own 826_role/826_session_token cookies are withheld
    // until MFA succeeds (step 3 below), since MFA is mandatory for every
    // login. Single-active-session enforcement moves to completeLogin() too,
    // which runs after that, not here.
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError || !authData.user) {
      // A lock that already expired (>60s since the last failure) starts a
      // fresh window instead of counting up indefinitely — matches the
      // client's own reset-after-cooldown behavior.
      const expiredWindow = account.failed_login_count >= LOCKOUT_THRESHOLD
        && failedAt !== null && Date.now() - failedAt >= LOCKOUT_MS
      const nextCount = expiredWindow ? 1 : account.failed_login_count + 1

      await admin.from("user_account").update({
        failed_login_count: nextCount,
        failed_login_at:    new Date().toISOString(),
      }).eq("id", account.id)

      // Every failed attempt gets its own entry — not just the one that
      // trips the lockout — so Security Logs shows the full picture. The
      // attempt count lives in `target`, not templated into `action`, so the
      // Security Logs filter can match it with a plain equality check like
      // every other event.
      await logAudit({
        user_id:   account.id,
        user_name: account.full_name,
        role:      account.role,
        category:  "auth",
        action:    "Failed login attempt",
        target:    `${username} — attempt ${nextCount}/${LOCKOUT_THRESHOLD}`,
      })

      if (nextCount >= LOCKOUT_THRESHOLD) {
        await logAudit({
          user_id:   account.id,
          user_name: account.full_name,
          role:      account.role,
          category:  "auth",
          action:    "Account locked out after 3 failed login attempts",
          target:    username,
        })
        return NextResponse.json(
          { error: "Too many failed attempts. Please wait 1 minute.", retryAfterSeconds: 60 },
          { status: 423 }
        )
      }

      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Archived accounts never get a session, even with the correct password —
    // checked here, after credential verification, not folded into the
    // earlier lookup, so an archived account and a wrong password are
    // genuinely indistinguishable from outside (same response, same status,
    // same code path up to this point). A correct password against an
    // archived account is a strong probing signal worth its own log entry —
    // deliberately not touching the failed-attempt counter, since the
    // credentials themselves were right.
    if (account.is_archived) {
      // signInWithPassword above already minted a real Supabase session for
      // this correct password — revoke it immediately (scope "global": every
      // session this user has, not just this one) so an archived account
      // never ends up with a dangling valid session we just never told our
      // own cookies/active-session table about.
      if (authData.session) {
        await admin.auth.admin.signOut(authData.session.access_token, "global")
      }
      await logAudit({
        user_id:   account.id,
        user_name: account.full_name,
        role:      account.role,
        category:  "auth",
        action:    "Login attempt on archived account with correct password",
        target:    username,
      })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    if (account.must_change_password) {
      // Mandatory password change still ahead — that screen requires its own
      // MFA verification before the new password takes effect
      // (app/api/auth/change-password/route.ts). Challenging for MFA here
      // too would mean checking email/authenticator twice for one login;
      // skip it here and let the change-password step be the single
      // checkpoint.
      return completeLogin(
        admin,
        supabase,
        authData.user.id,
        "Logged in — MFA deferred to mandatory password change",
      )
    }

    // 3. Credentials are good — MFA is mandatory for every account, so this
    // never issues this app's own session cookies directly. TOTP is
    // preferred when the account has a verified authenticator factor
    // enrolled (Settings → Two-Factor Authentication); otherwise email-code
    // is the universal default, no enrollment required. Checked via the
    // session-scoped client (now authenticated from signInWithPassword
    // above) — listFactors() with no args reads the current session's user.
    const { data: factorData } = await supabase.auth.mfa.listFactors()
    const totpFactor = factorData?.totp?.[0]

    if (totpFactor) {
      const { challengeId, method } = await createTotpChallenge(admin, authData.user.id, totpFactor.id)
      return NextResponse.json({ mfaRequired: true, method, challengeId })
    }

    if (!account.email) {
      // No TOTP factor and no contact email to send a code to — an account
      // from before the email field shipped (or edited around it). MFA can
      // never be enforced on a channel that doesn't exist, and hard-blocking
      // here would permanently lock the account out with no way back in (an
      // admin can't fix it either, if THEIR account is in the same state).
      // Complete the login directly instead, same as before MFA existed —
      // logged explicitly so it's visible, not a silent gap. An admin can
      // add this account's email from Account Management any time after.
      return completeLogin(
        admin,
        supabase,
        authData.user.id,
        "Logged in without MFA — no verification method on file",
      )
    }

    const { challengeId, method, emailSent } = await createEmailChallenge(
      admin,
      authData.user.id,
      account.email,
      account.full_name,
    )
    if (!emailSent) {
      await admin.from("login_mfa_challenge").update({ used_at: new Date().toISOString() }).eq("id", challengeId)
      return NextResponse.json(
        { error: "We couldn't send your verification code right now. Please try again shortly or contact an admin." },
        { status: 500 },
      )
    }
    return NextResponse.json({ mfaRequired: true, method, challengeId })

  } catch (err) {
    console.error("Login route error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
