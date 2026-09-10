import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
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
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // No session at all — this is the normal shape of a deliberate logout
      // (hooks/useLogout.ts signs out, then this check can fire before the
      // redirect completes) just as much as a genuinely stale one. Distinct
      // from "mismatch" below so the caller doesn't misreport an ordinary
      // logout as "signed in on another device".
      return NextResponse.json({ valid: false, reason: "no_session" }, { headers: { "Cache-Control": "no-store" } })
    }

    const sessionToken = cookieStore.get("826_session_token")?.value ?? null
    const valid = await isSessionCurrent(supabase, user.id, sessionToken)

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
