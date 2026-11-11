import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/auth/force-logout — ends the session of an account that was
// archived while its owner was still signed in.
//
// Reached by redirect from requireRole() (lib/auth/guard.ts) and by the
// session-enforcement hook. It exists because neither can end a session
// themselves: a Server Component can't clear cookies, and proxy.ts bounces
// any still-authenticated visitor off /login back to their dashboard — so a
// plain redirect to /login would loop. /api/* sits outside the proxy matcher.
//
// Deliberately conditional: it only signs out a caller who is *actually*
// archived. Otherwise a link to this URL would be a one-click "log anyone
// out" (logout CSRF), and there is no user-supplied reason to trust — the
// only reason it can ever report is the one it just verified.
export async function GET(request: Request) {
  const login = (reason?: string) => {
    const url = new URL("/login", request.url)
    if (reason) url.searchParams.set("reason", reason)
    return NextResponse.redirect(url)
  }

  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return login()

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("user_account")
      .select("is_archived")
      .eq("id", user.id)
      .single()

    // Not archived: nothing to do here. Send them to /login, which routes a
    // signed-in user to their own dashboard.
    if (profile?.is_archived !== true) return login()

    await supabase.auth.signOut()

    const response = login("account_archived")
    response.cookies.set("826_role", "", { maxAge: 0, path: "/" })
    response.cookies.set("826_session_token", "", { maxAge: 0, path: "/" })
    return response
  } catch (err) {
    // Couldn't verify (e.g. Supabase Auth briefly unavailable) — don't sign
    // anyone out on a guess; the next request re-runs the archived check.
    console.error("[force-logout] failed:", err)
    return login()
  }
}
