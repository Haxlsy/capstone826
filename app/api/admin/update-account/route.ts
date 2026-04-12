import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const body = await request.json()
  const { userId, fullName, role, password } = body

  if (!userId || !fullName || !role) {
    return NextResponse.json({ error: "userId, fullName, and role are required." }, { status: 400 })
  }

  // Only super_admin can assign admin role
  if (role === "admin") {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user: caller } } = await supabase.auth.getUser()

    if (caller) {
      const { data: callerProfile } = await supabase
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
  }

  const supabase = createAdminClient()

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

  return NextResponse.json({ success: true })
}
