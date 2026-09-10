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

  const { data } = await supabase
    .from("user_active_session")
    .select("session_token")
    .eq("user_id", userId)
    .maybeSingle()

  return data?.session_token === sessionToken
}
