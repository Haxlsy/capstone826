import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"

export async function POST(request: Request) {
  const body = await request.json()
  const { userId, fullName, role, password } = body

  if (!userId || !fullName || !role) {
    return NextResponse.json({ error: "userId, fullName, and role are required." }, { status: 400 })
  }

  const cookieStore = await cookies()
  const userClient  = createClient(cookieStore)
  const { data: { user: caller } } = await userClient.auth.getUser()

  const admin = createAdminClient()

  // Only super_admin can assign admin role
  if (role === "admin" && caller) {
    const { data: callerProfile } = await admin
      .from("user_account")
      .select("role")
      .eq("id", caller.id)
      .single()

    if (callerProfile?.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only a Super Admin can assign the Admin role." },
        { status: 403 }
      )
    }
  }

  const supabase = admin

  const { error: profileError } = await supabase
    .from("user_account")
    .update({ full_name: fullName.trim(), role })
    .eq("id", userId)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (password) {
    const { error: pwError } = await supabase.auth.admin.updateUserById(userId, { password })
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 500 })
    }
  }

  if (caller) {
    const { data: callerProf } = await admin
      .from("user_account")
      .select("full_name, role")
      .eq("id", caller.id)
      .single()
    if (callerProf) {
      logAudit({
        user_id:   caller.id,
        user_name: callerProf.full_name,
        role:      callerProf.role,
        category:  "update",
        action:    "Updated account",
        target:    fullName.trim(),
      })
    }
  }

  return NextResponse.json({ success: true })
}
