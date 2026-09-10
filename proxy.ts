import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware-client";
import { isSessionCurrent } from "@/lib/auth/session-check";

const ROLE_HOMES: Record<string, string> = {
  super_admin:    "/dashboard/admin",
  admin:          "/dashboard/admin",
  operations:     "/dashboard/operations",
  sales:          "/dashboard/sales",
  head_detailer:  "/head-technician",
  head_installer: "/head-technician",
};

export async function proxy(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request);

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const role = request.cookies.get("826_role")?.value ?? "";

  const isProtectedArea =
    path.startsWith("/dashboard") || path.startsWith("/head-technician");
  const isAuthPage = path === "/login" || path === "/";

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

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
