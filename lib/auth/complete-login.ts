import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Finishes a login once MFA has been verified — everything the original
 * login route used to do right after signInWithPassword, extracted so
 * app/api/auth/verify-mfa/route.ts (the only caller now that MFA is
 * mandatory for every login) can run it after the second factor checks out,
 * not before. Single active session enforcement, failed-attempt counter
 * reset, "Logged in" audit entry, and issuing this app's own 826_role /
 * 826_session_token cookies — unchanged in substance from the pre-MFA login
 * route, just relocated.
 */
export async function completeLogin(
  admin: AdminClient,
  supabase: SupabaseClient,
  userId: string,
  username: string,
): Promise<NextResponse> {
  const { data: account, error: acctError } = await admin
    .from("user_account")
    .select("full_name, role, email, must_change_password")
    .eq("id", userId)
    .single()

  if (acctError || !account) {
    return NextResponse.json({ error: "Account not found." }, { status: 500 })
  }

  const profile = {
    username,
    full_name:            account.full_name,
    role:                 account.role,
    email:                account.email,
    must_change_password: account.must_change_password,
  }

  const [{ data: { session } }, { data: existingSession }] = await Promise.all([
    supabase.auth.getSession(),
    admin.from("user_active_session").select("user_id").eq("user_id", userId).maybeSingle(),
  ])
  const hadExistingSession = !!existingSession

  const sessionToken = crypto.randomUUID()

  const [, sessionUpsertResult] = await Promise.all([
    session
      ? admin.auth.admin.signOut(session.access_token, "others")
      : Promise.resolve(),
    admin.from("user_active_session").upsert({
      user_id:       userId,
      session_token: sessionToken,
    }),
    admin.from("user_account").update({
      failed_login_count: 0,
      failed_login_at:    null,
    }).eq("id", userId),
    logAudit({
      user_id:   userId,
      user_name: profile.full_name,
      role:      profile.role,
      category:  "auth",
      action:    "Logged in",
      target:    username,
    }),
  ])

  if (hadExistingSession) {
    await logAudit({
      user_id:   userId,
      user_name: profile.full_name,
      role:      profile.role,
      category:  "auth",
      action:    "Logged in — ended a previous active session on another device",
      target:    profile.full_name,
    })
  }

  if (sessionUpsertResult.error) {
    console.error("[completeLogin] user_active_session upsert failed:", sessionUpsertResult.error.message)
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
}
