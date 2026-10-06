import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRoleCaller } from "@/lib/auth/caller"
import { startOfPeriod } from "@/hooks/audit-helpers"
import type { TimePeriod } from "@/types/audit"
import {
  isAuditSortColumn, isAuditSortDir, isAuditScope, SECURITY_CATEGORY,
} from "@/lib/admin/audit-log-query"

// ── GET /api/admin/audit-log ──────────────────────────────────────────────────
// Query params: scope (activity|security, default activity), role, category
// (activity scope), action (security scope, exact match), period
// (all|week|month, default all), sortBy, sortDir (default created_at desc),
// page, pageSize (default 1 / 10).
// Used by the admin AuditLog dashboard component (Audit Trail + Security Logs
// tabs) via hooks/use-audit-logs.ts.
export async function GET(request: Request) {
  try {
    const auth = await getRoleCaller(["admin", "super_admin"])
    if ("error" in auth) return auth.error

    const url      = new URL(request.url)
    const scope    = isAuditScope(url.searchParams.get("scope")) ? url.searchParams.get("scope")! : "activity"
    const role     = url.searchParams.get("role")     || null
    const category = url.searchParams.get("category") || null
    const action   = url.searchParams.get("action")   || null
    const period   = (url.searchParams.get("period") ?? "all") as TimePeriod
    const sortBy   = isAuditSortColumn(url.searchParams.get("sortBy")) ? url.searchParams.get("sortBy")! : "created_at"
    const sortDir  = isAuditSortDir(url.searchParams.get("sortDir")) ? url.searchParams.get("sortDir")! : "desc"
    const page     = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10))
    const pageSize = Math.min(500, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "10", 10)))

    const admin = createAdminClient()

    let query = admin
      .from("audit_log")
      .select("id, user_id, user_name, role, category, action, target, created_at", { count: "exact" })
      .order(sortBy, { ascending: sortDir === "asc" })

    // A single `.order()` leaves ties (e.g. many rows sharing the same
    // target) in whatever order Postgres happens to return them — not just
    // cosmetically inconsistent, but unsafe to paginate over, since the tie
    // order isn't guaranteed stable between the requests that fetch each
    // page. `created_at desc` makes ties land newest-first (skipped when
    // that's already the primary column), and `id` is the final, always-
    // unique tiebreaker that makes the full ordering deterministic.
    if (sortBy !== "created_at") query = query.order("created_at", { ascending: false })
    query = query.order("id", { ascending: true })

    if (scope === "activity") {
      query = query.neq("category", SECURITY_CATEGORY)
      if (category) query = query.eq("category", category)
    } else {
      query = query.eq("category", SECURITY_CATEGORY)
      if (action) query = query.eq("action", action)
    }

    if (role) query = query.eq("role", role)

    const since = startOfPeriod(period)
    if (since) query = query.gte("created_at", since.toISOString())

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, count, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const total = count ?? 0
    return NextResponse.json({
      logs:    data ?? [],
      total,
      hasMore: from + (data?.length ?? 0) < total,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST /api/admin/audit-log ─────────────────────────────────────────────────
// Body: { user_id, user_name, role, category, action, target }
// Nothing in the codebase currently calls this (login/logout write audit rows
// by importing logAudit()/logAuditCall() directly, not over HTTP) — but it was
// still a live, public route with no auth check, trusting every field
// (including user_id/user_name/role) straight from the request body. Gated
// the same as GET so a reachable-but-unused route can't be used to insert a
// forged entry attributed to anyone.
export async function POST(request: Request) {
  try {
    const auth = await getRoleCaller(["admin", "super_admin"])
    if ("error" in auth) return auth.error

    const body = await request.json()
    const { user_id, user_name, role, category, action, target } = body

    if (!user_name || !role || !category || !action) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
    }

    const admin = createAdminClient()

    const { error } = await admin.from("audit_log").insert({
      user_id:   user_id ?? null,
      user_name,
      role,
      category,
      action,
      target:    target ?? "",
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
