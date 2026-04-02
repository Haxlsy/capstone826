import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const search = searchParams.get("search") ?? ""
  const role = searchParams.get("role") ?? "all"
  const status = searchParams.get("status") ?? "all"
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const pageSize = Math.max(1, Number(searchParams.get("pageSize") ?? "15"))

  console.log("[/api/admin/accounts] GET", { search, role, status, page, pageSize })

  const supabase = createAdminClient()

  let query = supabase
    .from("profile")
    .select("user_id, full_name, user_name, role, contact_no, is_archived, created_at", {
      count: "exact",
    })
    .neq("role", "admin")
    .order("created_at", { ascending: false })

  if (search.trim()) {
    query = query.or(
      `full_name.ilike.%${search.trim()}%,user_name.ilike.%${search.trim()}%`
    )
  }
  if (role !== "all") {
    query = query.eq("role", role)
  }
  if (status === "active") {
    query = query.eq("is_archived", false)
  } else if (status === "archived") {
    query = query.eq("is_archived", true)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    console.error("[/api/admin/accounts] query error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("[/api/admin/accounts] returning", data?.length, "rows, total:", count)
  return NextResponse.json({ accounts: data ?? [], total: count ?? 0 })
}
