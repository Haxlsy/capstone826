import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware-client";
import { isSessionCurrent } from "@/lib/auth/session-check";
import { isDeadSessionError } from "@/lib/auth/refresh-errors";

const ROLE_HOMES: Record<string, string> = {
  super_admin:    "/dashboard/admin",
  admin:          "/dashboard/admin",
  operations:     "/dashboard/operations",
  sales:          "/dashboard/sales",
  head_detailer:  "/head-technician",
  head_installer: "/head-technician",
};

// Supabase's session cookie, including its chunked form (sb-<ref>-auth-token.0, .1, …).
const AUTH_COOKIE_RE = /^sb-.+-auth-token(\.\d+)?$/;

function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((c) => AUTH_COOKIE_RE.test(c.name));
}

// Expire every auth cookie on the response that's actually being returned.
// The Supabase client queues its own deletions on `supabaseResponse`, but any
// redirect built here is a brand-new response that silently drops them — so a
// dead session's cookies kept coming back on every request and every request
// retried (and logged) the same doomed refresh.
function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const c of request.cookies.getAll()) {
    if (AUTH_COOKIE_RE.test(c.name)) response.cookies.set(c.name, "", { maxAge: 0, path: "/" });
  }
  response.cookies.set("826_role", "", { maxAge: 0, path: "/" });
  response.cookies.set("826_session_token", "", { maxAge: 0, path: "/" });
  return response;
}

export async function proxy(request: NextRequest) {
  // A request can never be allowed to set this itself — only this function,
  // after a verified getUser() call below, may add it back. Without this
  // strip, a request that simply included the header would be trusted as
  // whichever user id it named (see lib/auth/guard.ts's getCurrentUser()).
  request.headers.delete("x-verified-user-id");

  const { supabase, supabaseResponse } = createClient(request);

  // No session cookie means there's nothing to verify or refresh — skip the
  // round trip to Supabase Auth entirely (every logged-out /login and / hit).
  let user = null;
  let sessionDead = false;
  if (hasAuthCookie(request)) {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    // The refresh token is gone (revoked by another login, a logout, …) — a
    // session that can never recover, unlike a network blip.
    sessionDead = !user && isDeadSessionError(error);
  }

  const path = request.nextUrl.pathname;
  const role = request.cookies.get("826_role")?.value ?? "";

  const isProtectedArea =
    path.startsWith("/dashboard") || path.startsWith("/head-technician");
  const isAuthPage = path === "/login" || path === "/";

  if (sessionDead) {
    if (isProtectedArea) {
      // One hop to /login. That request arrives with no auth cookies (cleared
      // here), so it skips Supabase above and /login only redirects when a
      // user exists — no way to loop.
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("reason", "session_expired");
      return clearAuthCookies(request, NextResponse.redirect(redirectUrl));
    }
    return clearAuthCookies(request, supabaseResponse);
  }

  if (!user && isProtectedArea) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Single active session per account — checked on every navigation here as
  // a first line of defense; hooks/useSessionEnforcement.ts covers the gap
  // this alone can't (an idle tab that never navigates) via a Realtime push
  // instead. See supabase/migrations/20260910000002_user_active_session.sql
  // and 20260910000003_user_active_session_realtime.sql.
  if (user && isProtectedArea) {
    const sessionToken = request.cookies.get("826_session_token")?.value ?? null;
    const current = await isSessionCurrent(supabase, user.id, sessionToken);

    if (!current) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("reason", "signed_in_elsewhere");
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set("826_role", "", { maxAge: 0, path: "/" });
      response.cookies.set("826_session_token", "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  if (user && isAuthPage) {
    const destination = ROLE_HOMES[role] ?? "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (user) {
    // getUser() above already did the one network-verified check this request
    // needs. Forward that result to the page render via a request header so
    // lib/auth/guard.ts's getCurrentUser() doesn't pay for the exact same
    // Supabase Auth round trip again a moment later — it can't share this
    // function's result directly since middleware and the page render are
    // separate phases of the Next.js request lifecycle.
    request.headers.set("x-verified-user-id", user.id);
    const finalResponse = NextResponse.next({ request });
    // Carry forward any cookies Supabase attached to supabaseResponse (e.g. a
    // refreshed access/refresh token) — constructing a fresh NextResponse.next()
    // here does NOT inherit them automatically. Dropping this would silently
    // break session refresh.
    supabaseResponse.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));
    return finalResponse;
  }

  return supabaseResponse;
}

// Only the routes that actually depend on the session. Everything else — the
// service worker, manifest, icons, images, /offline, /api (which authenticates
// itself) — must not pay a Supabase Auth round trip per request. Role access
// is still enforced by requireRole() in the layouts and the getRoleCaller API
// gates, not by this file alone.
export const config = {
  matcher: [
    "/",
    "/login",
    "/change-password-required",
    "/dashboard/:path*",
    "/head-technician/:path*",
  ],
};
