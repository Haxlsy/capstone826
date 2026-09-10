import type { SupabaseClient } from "@supabase/supabase-js"

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
