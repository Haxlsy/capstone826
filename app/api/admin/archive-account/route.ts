import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { getRoleCaller } from "@/lib/auth/caller"

export async function POST(request: Request) {
  const auth = await getRoleCaller(["admin", "super_admin"])
  if ("error" in auth) return auth.error

  const { userId, isArchived } = await request.json()

  if (!userId || typeof isArchived !== "boolean") {
    return NextResponse.json({ error: "userId and isArchived (boolean) are required." }, { status: 400 })
  }

  const admin = createAdminClient()

  const [{ data: target }, callerResult] = await Promise.all([
    admin.from("user_account").select("full_name, role").eq("id", userId).single(),
    (async () => {
      const cookieStore = await cookies()
      const supabase = createClient(cookieStore)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data: prof } = await admin.from("user_account").select("full_name, role").eq("id", user.id).single()
      return prof ? { id: user.id, ...prof } : null
    })(),
  ])

  const { error } = await admin
    .from("user_account")
    .update({ is_archived: isArchived })
    .eq("id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (callerResult && target) {
    logAudit({
      user_id:   callerResult.id,
      user_name: callerResult.full_name,
      role:      callerResult.role,
      category:  "delete",
      action:    isArchived ? "Archived account" : "Restored account",
      target:    target.full_name,
    })
  }

  return NextResponse.json({ success: true })
}
