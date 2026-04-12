import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    await supabase.auth.signOut()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
