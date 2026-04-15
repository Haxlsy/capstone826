import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ── GET /api/admin/audit-log ──────────────────────────────────────────────────
// Query params: role, category, limit (default 200)
// Used by the admin AuditLog dashboard component.
export async function GET(request: Request) {
  try {
    const url      = new URL(request.url)
    const role     = url.searchParams.get("role")     ?? null
    const category = url.searchParams.get("category") ?? null
    const limit    = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10), 500)

    const admin = createAdminClient()

    let query = admin
      .from("audit_log")
      .select("id, user_id, user_name, role, category, action, target, created_at")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (role)     query = query.eq("role",     role)
    if (category) query = query.eq("category", category)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ logs: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST /api/admin/audit-log ─────────────────────────────────────────────────
// Internal-only: called by login/logout routes using the admin client.
// Body: { user_id, user_name, role, category, action, target }
export async function POST(request: Request) {
  try {
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
