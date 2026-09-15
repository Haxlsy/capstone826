import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const LoginSchema = z.object({
  username: z.string().trim().min(1, "Username required").max(100),
  password: z.string().min(1, "Password required").max(128),
})

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

    // 1. Resolve email via RPC
    const { data: email, error: lookupError } = await admin
      .rpc("get_user_email_by_username", { p_username: username })

    if (lookupError || !email) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // 2. Sign in
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !authData.user) {
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

    // 4. Single active session per account — revoke every other session this
    // user has anywhere else, then record this one as the current session so
    // proxy.ts can recognize (and reject) a stale browser immediately rather
    // than waiting on Supabase's own revocation to be noticed. See
    // docs/plan and supabase/migrations/20260910000002_user_active_session.sql.
    //
    // 5. Log Event (Awaited for reliability in Serverless)
    //
    // These three only depend on authData.user/session, resolved above — none
    // depend on EACH OTHER — so they run concurrently instead of one after
    // another (each is a full network/DB round trip; sequentially awaiting all
    // three was pure added latency on every login).
    const sessionToken = crypto.randomUUID()
    const [, sessionUpsertResult] = await Promise.all([
      authData.session
        ? admin.auth.admin.signOut(authData.session.access_token, "others")
        : Promise.resolve(null),
      admin.from("user_active_session").upsert({
        user_id:       authData.user.id,
        session_token: sessionToken,
      }),
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
