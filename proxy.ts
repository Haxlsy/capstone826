import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware-client";

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

  // Single active session per account — a newer login elsewhere overwrites
  // this user's row (app/api/auth/login/route.ts), so a stale browser's
  // cookie stops matching it immediately. RLS scopes the read to the
  // caller's own row (user_id = auth.uid()), same as push_subscription.
  // See supabase/migrations/20260910000002_user_active_session.sql.
  if (user && isProtectedArea) {
    const sessionToken = request.cookies.get("826_session_token")?.value ?? null;
    const { data: activeSession } = await supabase
      .from("user_active_session")
      .select("session_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sessionToken || activeSession?.session_token !== sessionToken) {
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
