import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"

const LoginSchema = z.object({
  username: z.string().trim().min(1, "Username required").max(100),
  password: z.string().min(1, "Password required").max(128),
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

    const { username, password } = parsed.data

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
        .select("id, full_name, role, must_change_password, failed_login_count, failed_login_at")
        .eq("username", username)
        .eq("is_archived", false)
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

    // 2. Sign in
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

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

      if (nextCount >= LOCKOUT_THRESHOLD) {
        logAudit({
          user_id:   account.id,
          user_name: account.full_name,
          role:      account.role,
          category:  "flag",
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

    // 3. Fetch Profile & Check Permissions
    const { data: profile, error: profileError } = await admin
      .from("user_account")
      .select("username, full_name, role, must_change_password")
      .eq("id", authData.user.id)
      .eq("is_archived", false)
      .single()

    if (profileError || !profile) {
      // Clean up the session if the profile check fails
      await supabase.auth.signOut()
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
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
      target:    "",
    })
  } catch (e) {
    console.error("Failed to write audit log:", e)
  }
}
