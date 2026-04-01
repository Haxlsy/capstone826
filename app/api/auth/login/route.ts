import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // look up the email from the username via DB function
  // (Supabase Auth requires email for signInWithPassword)
  const { data: email, error: lookupError } = await supabase
    .rpc("get_user_email_by_username", { p_username: username })

  if (lookupError || !email) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
  }

  // sign in with email + password
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !data.user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
  }

  // fetch profile to confirm user is in our DB and not archived
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("user_name, full_name, role")
    .eq("user_id", data.user.id)
    .eq("is_archived", false)
    .single()

  if (profileError || !profile) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: "Access denied." }, { status: 403 })
  }

  return NextResponse.json({ user: profile })
}
