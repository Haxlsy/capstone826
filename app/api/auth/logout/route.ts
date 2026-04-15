import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)

    // Capture identity before signing out
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.auth.signOut()

    // Log the logout event after sign-out (fire-and-forget)
    if (user) {
      const admin = createAdminClient()
      admin
        .from("user_account")
        .select("full_name, role")
        .eq("id", user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile) {
            admin.from("audit_log").insert({
              user_id:   user.id,
              user_name: profile.full_name,
              role:      profile.role,
              category:  "auth",
              action:    "Logged out",
              target:    "",
            }).then(() => {}).catch(() => {})
          }
        })
        .catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
