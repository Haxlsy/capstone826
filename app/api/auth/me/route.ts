import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/auth/me — the current user's own profile, for the Settings
// "Account Info" card. localStorage's "826_user" already carries
// full_name/username/role from login, but not created_at, so this is a
// small fresh read rather than reusing that cached value.
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile, error } = await admin
      .from("user_account")
      .select("full_name, username, role, email, created_at")
      .eq("id", user.id)
      .single()

    if (error || !profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 })

    return NextResponse.json({ user: profile })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
