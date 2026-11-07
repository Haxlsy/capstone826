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

  const build = (columns: string) => {
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

    if (search.trim()) {
      query = query.or(
        `full_name.ilike.%${search.trim()}%,username.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`
      )
    }
    if (role !== "all") query = query.eq("role", role)
    if (status === "active")   query = query.eq("is_archived", false)
    if (status === "archived") query = query.eq("is_archived", true)

    const from = (page - 1) * pageSize
    return query.range(from, from + pageSize - 1)
  }

  let { data, count, error } = await build(`${BASE_COLUMNS}, ${TEMP_COLUMNS}`)
  // 42703 = undefined column: the temporary-head migration hasn't run yet.
  // Fall back to the original columns so Account Management keeps working.
  if (error?.code === "42703") ({ data, count, error } = await build(BASE_COLUMNS))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ accounts: data ?? [], total: count ?? 0 })
}
