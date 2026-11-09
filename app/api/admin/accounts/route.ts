import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRoleCaller } from "@/lib/auth/caller"

export async function GET(request: Request) {
  const auth = await getRoleCaller(["admin", "super_admin"])
  if ("error" in auth) return auth.error

  const { searchParams } = new URL(request.url)
  const search   = searchParams.get("search")   ?? ""
  const role     = searchParams.get("role")     ?? "all"
  const status   = searchParams.get("status")   ?? "all"
  const page     = Math.max(1, Number(searchParams.get("page")     ?? "1"))
  const pageSize = Math.max(1, Number(searchParams.get("pageSize") ?? "15"))
  // admin=true fetches admin-role accounts only (Super Admin tab)
  const adminOnly = searchParams.get("admin") === "true"

  const supabase = createAdminClient()

  const BASE_COLUMNS = "id, full_name, first_name, last_name, email, username, role, is_archived, created_at"
  // Temporary Head Technician columns, so Admin sees which logins are
  // temporary and whether their access has ended.
  const TEMP_COLUMNS = "is_temporary_head, access_expires_at"

  const nowIso = new Date().toISOString()

  // `withTemp`: the temporary-head columns exist, so the status filters can
  // use them. Without them (migration not run) they're skipped.
  const build = (columns: string, withTemp: boolean) => {
    let query = supabase
      .from("user_account")
      .select(columns, { count: "exact" })
      .order("created_at", { ascending: false })

    if (adminOnly) {
      query = query.eq("role", "admin")
    } else {
      // Exclude super_admin and admin from the general staff list
      query = query.not("role", "in", '("super_admin","admin")')
    }

    const searchOr = search.trim()
      ? `full_name.ilike.%${search.trim()}%,username.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`
      : null
    // Active = only accounts that can actually log in: a Temporary Head whose
    // one-day access has ended isn't active (it's kept, and listed under
    // "Temporary heads", so the login is reused next time).
    const activeOr = status === "active" && withTemp
      ? `is_temporary_head.eq.false,access_expires_at.gt.${nowIso}`
      : null
    // Both are OR groups; send them as ONE filter (and(or(..),or(..))) rather
    // than two separate `or` parameters.
    if (searchOr && activeOr) query = query.or(`and(or(${searchOr}),or(${activeOr}))`)
    else if (searchOr) query = query.or(searchOr)
    else if (activeOr) query = query.or(activeOr)

    if (role !== "all") query = query.eq("role", role)
    if (status === "active") query = query.eq("is_archived", false)
    if (status === "archived") query = query.eq("is_archived", true)
    // Every Temporary Head login, still active today or already ended.
    if (status === "temporary") query = query.eq("is_temporary_head", true)

    const from = (page - 1) * pageSize
    return query.range(from, from + pageSize - 1)
  }

  let { data, count, error } = await build(`${BASE_COLUMNS}, ${TEMP_COLUMNS}`, true)
  // 42703 = undefined column: the temporary-head migration hasn't run yet.
  // Fall back to the original columns so Account Management keeps working
  // (there are no temporary heads to list in that case).
  if (error?.code === "42703") {
    if (status === "temporary") return NextResponse.json({ accounts: [], total: 0 })
    ;({ data, count, error } = await build(BASE_COLUMNS, false))
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ accounts: data ?? [], total: count ?? 0 })
}
