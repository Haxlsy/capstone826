import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isSessionCurrent, resolveStaleSessionCurrency } from "@/lib/auth/session-check"

// GET /api/auth/session-status — single active session per account.
// Called by hooks/useSessionEnforcement.ts when a Realtime event on
// user_active_session says "something changed for my account, go check" —
// the httpOnly 826_session_token cookie can't be read by that hook directly,
// so this is the server-side confirmation step. proxy.ts runs the same
// check on every navigation; this covers the gap that alone can't (an idle
// tab that never navigates).
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const sessionToken = cookieStore.get("826_session_token")?.value ?? null
    // Known, trustworthy before this session ever went stale — it's the same
    // id hooks/useSessionEnforcement.ts already uses to filter its Realtime
    // subscription. Only affects which EXPLANATION text gets shown below
    // (isSessionCurrent only ever reports true/false for whichever user_id is
    // asked about — nothing privileged), not any actual access decision, so
    // trusting it here is low-risk and lets the check below skip decoding a
    // session that, as of the comment a few lines down, may already be too
    // dead to decode.
    const clientUserId = request.nextUrl.searchParams.get("userId")

    if (!sessionToken) {
      // No cookie at all — the shape of a deliberate logout
      // (app/api/auth/logout/route.ts actively clears this cookie, and this
      // check can fire before that flow's own redirect completes). Nothing
      // left to compare against, so nothing to report as a mismatch.
      return NextResponse.json({ valid: false, reason: "no_session" }, { headers: { "Cache-Control": "no-store" } })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Archived while signed in — checked BEFORE the token comparison:
      // archiving rotates this user's session_token to kick their open tabs,
      // which would otherwise read as a plain "mismatch" and tell them they
      // signed in on another device. (See app/api/admin/archive-account.)
      const { data: profile } = await createAdminClient()
        .from("user_account")
        .select("is_archived")
        .eq("id", user.id)
        .single()
      if (profile?.is_archived === true) {
        return NextResponse.json({ valid: false, reason: "archived" }, { headers: { "Cache-Control": "no-store" } })
      }

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
    // elsewhere" case, not a false positive.
    //
    // Prefer the client-supplied userId when present: it sidesteps needing to
    // decode this now-dead session at all. The signOut(..., "others") call
    // above can revoke the access token too, not just the refresh token — so
    // resolveStaleSessionCurrency's local decode (reading whatever's still in
    // this request's own cookie) doesn't always succeed in the same narrow
    // window the revocation itself happens in, which was observed to
    // misreport a genuine kick-out as "no_session" (no toast shown) rather
    // than the correct "mismatch".
    const valid = clientUserId
      ? await isSessionCurrent(createAdminClient(), clientUserId, sessionToken)
      : await resolveStaleSessionCurrency(supabase, sessionToken)

    if (valid === null) {
      return NextResponse.json({ valid: false, reason: "no_session" }, { headers: { "Cache-Control": "no-store" } })
    }

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
