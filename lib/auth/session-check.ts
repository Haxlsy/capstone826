import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

// Single active session per account — a newer login overwrites this user's
// row (app/api/auth/login/route.ts), so a stale browser's cookie stops
// matching it immediately. Shared between proxy.ts (checked on every page
// navigation) and app/api/auth/session-status/route.ts (checked on demand,
// e.g. when a Realtime event tells an idle tab to re-verify itself — see
// hooks/useSessionEnforcement.ts). RLS scopes the read to the caller's own
// row (user_id = auth.uid()), same as push_subscription.
export async function isSessionCurrent(
  supabase: SupabaseClient,
  userId: string,
  sessionToken: string | null,
): Promise<boolean> {
  if (!sessionToken) return false

  const { data, error } = await supabase
    .from("user_active_session")
    .select("session_token")
    .eq("user_id", userId)
    .maybeSingle()

  // Fail OPEN on an unexpected query error (missing table/migration not yet
  // applied, network blip, RLS misconfiguration) — this check runs on every
  // navigation and on every Realtime event for every role, so a fail-closed
  // default here would force-logout the entire app the moment this query
  // can't run at all, not just when it successfully finds a real mismatch.
  // A genuine "logged in elsewhere" case still reads and compares
  // correctly below; only the "couldn't even check" case changes.
  if (error) {
    console.error("[isSessionCurrent] query failed — not enforcing single-session for this check:", error.message)
    return true
  }

  return data?.session_token === sessionToken
}

/**
 * When `getUser()` has already failed, this figures out — as precisely as
 * the still-present (but dead) cookie allows — whether that's because
 * another login kicked this session out, versus a session that's simply
 * over. `getUser()`'s error alone can't reliably tell those apart: a
 * `signOut(token, "others")` revocation doesn't consistently surface as one
 * of the well-known "refresh token gone" error shapes `isDeadSessionError`
 * matches, so a caller that only looked at the error would treat a genuine
 * "kicked out elsewhere" the same as "never had a session at all."
 *
 * `staleClient` only needs to locally decode the JWT still sitting in the
 * cookie (`getSession()` does this without a live check, so it works even
 * though the session itself is already dead) to recover *whose* cookie this
 * was — it's never expected to successfully authenticate anything.
 *
 * Returns `null` when no stale identity could even be recovered (nothing
 * meaningful to compare — treat as no session at all), otherwise whether the
 * DB's `user_active_session` row still matches this exact token.
 *
 * Shared by `proxy.ts` (every navigation) and `/api/auth/session-status`
 * (an idle tab's Realtime-triggered check) so both agree.
 */
export async function resolveStaleSessionCurrency(
  staleClient: SupabaseClient,
  sessionToken: string | null,
): Promise<boolean | null> {
  if (!sessionToken) return null

  const { data: { session } } = await staleClient.auth.getSession()
  const staleUserId = session?.user?.id ?? null
  if (!staleUserId) return null

  // Read via the admin client — the caller's own client can't authenticate
  // anything at this point (that's the whole reason we're here), so it can't
  // pass RLS on its own.
  const admin = createAdminClient()
  return isSessionCurrent(admin, staleUserId, sessionToken)
}
