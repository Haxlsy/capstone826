import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { verifyTurnstileToken } from "@/lib/auth/turnstile"

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
        .select("id, full_name, role, must_change_password, failed_login_count, failed_login_at, is_archived")
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

    // 2. Sign in — alongside a check for an existing active session on this
    // account. Both only need `account.id`/the submitted credentials, so
    // this adds no extra round trip; if sign-in fails below, the result is
    // simply unused. user_active_session has one row per user and
    // app/api/auth/logout/route.ts deletes it on a clean logout, so a row
    // still being there means a previous session was never properly ended —
    // this login is about to end it (see the audit entry in step 4-7).
    const [{ data: authData, error: signInError }, { data: existingSession }] = await Promise.all([
      supabase.auth.signInWithPassword({ email, password }),
      admin.from("user_active_session").select("user_id").eq("user_id", account.id).maybeSingle(),
    ])
    const hadExistingSession = !!existingSession

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

    // 3. `account` (step 1) is already the exact row `authData.user.id` maps
    // to — user_account.id is a FK straight onto auth.users.id, and sign-in
    // can only have succeeded for the account just looked up — so build the
    // response profile from it instead of re-querying the same row again.
    const profile = {
      username,
      full_name:            account.full_name,
      role:                 account.role,
      must_change_password: account.must_change_password,
    }

    // 4-7. Four independent writes — none needs another's result (all only
    // need authData.user.id / authData.session.access_token / profile, all
    // already available) — so they run concurrently instead of one after
    // another. Still gated behind the profile check above: a rejected login
    // must never revoke the user's other sessions or record a bogus active
    // session, so this batch must not move earlier than it already is.
    //
    // Single active session per account — revoke every other session this
    // user has anywhere else, then record this one as the current session so
    // proxy.ts can recognize (and reject) a stale browser immediately rather
    // than waiting on Supabase's own revocation to be noticed. See
    // docs/plan and supabase/migrations/20260910000002_user_active_session.sql.
    const sessionToken = crypto.randomUUID()

    const [, sessionUpsertResult] = await Promise.all([
      authData.session
        ? admin.auth.admin.signOut(authData.session.access_token, "others")
        : Promise.resolve(),
      admin.from("user_active_session").upsert({
        user_id:       authData.user.id,
        session_token: sessionToken,
      }),
      // A successful login clears the failed-attempt counter (fresh 3-strike
      // window next time), matching the client's own reset-on-success behavior.
      admin.from("user_account").update({
        failed_login_count: 0,
        failed_login_at:    null,
      }).eq("id", authData.user.id),
      // Log Event (awaited alongside the others for reliability in
      // Serverless — a fire-and-forget write here was previously observed
      // getting dropped once the function returned).
      createAuditLog(admin, authData.user.id, profile, "Logged in"),
    ])

    // A security-relevant event worth its own visible entry — same category
    // the lockout event above uses — so it doesn't just look like an
    // ordinary "Logged in" alongside it in the Security & Audit Center.
    if (hadExistingSession) {
      await logAudit({
        user_id:   authData.user.id,
        user_name: profile.full_name,
        role:      profile.role,
        category:  "auth",
        action:    "Logged in — ended a previous active session on another device",
        target:    profile.full_name,
      })
    }

    if (sessionUpsertResult.error) {
      // Login still proceeds — see lib/auth/session-check.ts's isSessionCurrent,
      // which fails open when this row can't be read, so a failure here
      // doesn't lock the user out; it just means single-session enforcement
      // silently isn't active for this login until the underlying issue
      // (e.g. a migration not yet applied) is fixed. Logged so it's
      // diagnosable instead of silent.
      console.error("[login] user_active_session upsert failed:", sessionUpsertResult.error.message)
    }

    const response = NextResponse.json({ user: profile })
    response.cookies.set("826_role", profile.role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8h
    })
    response.cookies.set("826_session_token", sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8h — matches 826_role
    })

    return response

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
      target:    profile.username ?? "",
    })
  } catch (e) {
    console.error("Failed to write audit log:", e)
  }
}
