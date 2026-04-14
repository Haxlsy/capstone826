import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required." }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)

    // Get current user from their session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    // Verify current password using the admin client (persistSession: false)
    // so the verification does NOT touch or overwrite the user's session cookies.
    const admin = createAdminClient()
    const { error: verifyError } = await admin.auth.signInWithPassword({
      email:    user.email!,
      password: currentPassword,
    })

    if (verifyError) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 })
    }

    // Update password
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
