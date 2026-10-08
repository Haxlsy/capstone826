import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware-client";
import { isSessionCurrent, resolveStaleSessionCurrency } from "@/lib/auth/session-check";
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
  let authCheckFailed = false;
  if (hasAuthCookie(request)) {
    try {
      const { data, error } = await supabase.auth.getUser();
      user = data.user;
      // The refresh token is gone (revoked by another login, a logout, …) — a
      // session that can never recover, unlike a network blip.
      sessionDead = !user && isDeadSessionError(error);
    } catch (err) {
      // getUser() can throw instead of returning { error } for some failure
      // shapes (observed in production: AuthApiError "Request rate limit
      // reached"). This runs on every navigation to a protected route, so an
      // uncaught throw here previously took down the entire app — no HTTP
      // response at all, not even a Next.js error page, just the browser's
      // own "This page couldn't load" — until the outage cleared. Fail open,
      // same reasoning as isSessionCurrent()'s query-error handling
      // (lib/auth/session-check.ts): let the request through unverified
      // rather than force-logging out every signed-in user during a
      // transient outage. requireRole()/getCurrentUser() still perform a
      // full, independently-verified check at the page level.
      console.error("[proxy] auth.getUser() failed — passing request through unverified:", err);
      authCheckFailed = true;
    }
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

  if (!user && isProtectedArea && !authCheckFailed) {
    // getUser() failed, but NOT in a way isDeadSessionError() recognized
    // above (sessionDead was false) — that doesn't mean this visitor was
    // never logged in. A signOut(token, "others") from another device's
    // login doesn't reliably surface as one of the well-known "refresh token
    // gone" error shapes (see the same reasoning in
    // app/api/auth/session-status/route.ts), so an unrecognized error here
    // can still mean "kicked out elsewhere" — and sending that visitor to a
    // bare /login with no explanation is exactly the confusing, silent
    // logout this was supposed to prevent. Only skip the extra check when
    // there was no auth cookie at all — genuinely never logged in, nothing
    // to explain.
    if (hasAuthCookie(request)) {
      const sessionToken = request.cookies.get("826_session_token")?.value ?? null;
      const stillCurrent = await resolveStaleSessionCurrency(supabase, sessionToken);
      // `false` = confirmed kicked out by another login. `true`/`null` are
      // less certain (the DB still says current, or no stale identity could
      // even be recovered) but getUser() still failed either way, so this
      // request can't render the protected page regardless — redirect with
      // the more conservative "session ended" wording rather than naming a
      // specific cause we can't confirm.
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("reason", stillCurrent === false ? "signed_in_elsewhere" : "session_expired");
      return clearAuthCookies(request, NextResponse.redirect(redirectUrl));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Single active session per account — checked on every navigation here as
  // a first line of defense; hooks/useSessionEnforcement.ts covers the gap
  // this alone can't (an idle tab that never navigates) via a Realtime push
  // instead. See supabase/migrations/20260910000002_user_active_session.sql
  // and 20260910000003_user_active_session_realtime.sql.
  //
  // Also what tells apart a FULLY signed-in visitor from one mid-MFA: since
  // app/api/auth/login/route.ts, signInWithPassword() already gives Supabase
  // its own valid session (so `user` is truthy) before MFA is verified — our
  // own 826_role/826_session_token cookies are only set afterward, by
  // completeLogin() (app/api/auth/verify-mfa/route.ts). So `user` truthy
  // alone no longer means "fully logged in"; isSessionCurrent (which
  // requires a matching session token) does.
  const sessionToken = request.cookies.get("826_session_token")?.value ?? null;
  const current = user ? await isSessionCurrent(supabase, user.id, sessionToken) : false;

  if (user && isProtectedArea && !current) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("reason", "signed_in_elsewhere");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("826_role", "", { maxAge: 0, path: "/" });
    response.cookies.set("826_session_token", "", { maxAge: 0, path: "/" });
    return response;
  }

  if (user && isAuthPage && current) {
    const destination = ROLE_HOMES[role] ?? "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }
  // user is truthy but current is false and this is /login or / — an
  // MFA-pending (or otherwise incomplete) session. Falls through and renders
  // normally instead of bouncing away, so the visitor can finish MFA or sign
  // in fresh. This is also what stops the redirect loop a stale "signed in"
  // read would otherwise cause: /login -> (looks signed in) -> /dashboard ->
  // (not current) -> /login -> ... forever.

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
