import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isSessionCurrent } from "@/lib/auth/session-check"

// GET /api/auth/session-status — single active session per account.
// Called by hooks/useSessionEnforcement.ts when a Realtime event on
// user_active_session says "something changed for my account, go check" —
// the httpOnly 826_session_token cookie can't be read by that hook directly,
// so this is the server-side confirmation step. proxy.ts runs the same
// check on every navigation; this covers the gap that alone can't (an idle
// tab that never navigates).
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const sessionToken = cookieStore.get("826_session_token")?.value ?? null

    if (!sessionToken) {
      // No cookie at all — the shape of a deliberate logout
      // (app/api/auth/logout/route.ts actively clears this cookie, and this
      // check can fire before that flow's own redirect completes). Nothing
      // left to compare against, so nothing to report as a mismatch.
      return NextResponse.json({ valid: false, reason: "no_session" }, { headers: { "Cache-Control": "no-store" } })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const valid = await isSessionCurrent(supabase, user.id, sessionToken)
      return NextResponse.json(
        { valid, reason: valid ? undefined : "mismatch" },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    // getUser() failed — this device's session is already revoked (login
    // calls admin.auth.admin.signOut(newToken, "others"), which invalidates
    // the OLD device's session at the Auth server immediately, not just its
    // session_token row) — so by the time this runs, "kicked out by another
    // device" and "genuinely logged out" both look identical to getUser().
    // The cookie is still present here (checked above), which a deliberate
    // logout would have cleared — so this really is the "kicked out
    // elsewhere" case, not a false positive. getSession() decodes the JWT
    // locally (no live revocation check) purely to recover whose cookie this
    // was, so it still works even though the session itself is dead.
    const { data: { session } } = await supabase.auth.getSession()
    const staleUserId = session?.user?.id ?? null

    if (!staleUserId) {
      return NextResponse.json({ valid: false, reason: "no_session" }, { headers: { "Cache-Control": "no-store" } })
    }

    const admin = createAdminClient()
    const valid = await isSessionCurrent(admin, staleUserId, sessionToken)

    return NextResponse.json(
      { valid, reason: valid ? undefined : "mismatch" },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err: unknown) {
    console.error("[session-status] check failed:", err)
    // No `valid` field on error — a transient failure here (network blip, DB
    // hiccup) is not the same thing as a confirmed stale session, and the
    // caller (hooks/useSessionEnforcement.ts) only forces a logout on an
    // explicit `valid: false`, never on a non-2xx/malformed response.
    return NextResponse.json({ error: "Session check failed." }, { status: 500 })
  }
}
