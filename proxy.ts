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

  if (user && isAuthPage) {
    const destination = ROLE_HOMES[role] ?? "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
