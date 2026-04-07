import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const body = await request.json()
  const { userId, fullName, role, contactNo, password } = body

  if (!userId || !fullName || !role || !contactNo) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 })
  }

  // Only super_admin can assign admin or super_admin roles
  if (role === "admin" || role === "super_admin") {
    const cookieStore = await cookies()
    const supabaseUser = createClient(cookieStore)
    const { data: { user: caller } } = await supabaseUser.auth.getUser()

    let callerRole = ""
    if (caller) {
      const { data: callerProfile } = await supabaseUser
        .from("profile")
        .select("role")
        .eq("user_id", caller.id)
        .single()
      callerRole = callerProfile?.role ?? ""
    }

    if (callerRole !== "super_admin") {
      return NextResponse.json({ error: "Only a Super Admin can assign the Admin role." }, { status: 403 })
    }
  }

  const supabase = createAdminClient()

  const { error: profileError } = await supabase
    .from("profile")
    .update({ full_name: fullName.trim(), role, contact_no: contactNo.trim() })
    .eq("user_id", userId)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Update password only if provided
  if (password) {
    const { error: pwError } = await supabase.auth.admin.updateUserById(userId, { password })
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
