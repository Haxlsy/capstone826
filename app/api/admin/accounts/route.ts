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

  let query = supabase
    .from("user_account")
    .select("id, full_name, first_name, last_name, email, username, role, is_archived, created_at", {
      count: "exact",
    })
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
  query = query.range(from, from + pageSize - 1)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ accounts: data ?? [], total: count ?? 0 })
}
