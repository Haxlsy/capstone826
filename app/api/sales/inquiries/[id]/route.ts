import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const body = await request.json()
    const { status } = body

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()
    const updates: Record<string, any> = {}

    if (status === "resolved") {
      updates.status         = "resolved"
      updates.resolved_at    = new Date().toISOString()
      updates.resolved_by_id = user.id
    } else if (status === "open") {
      updates.status = "open"
    } else if (status !== undefined) {
      return NextResponse.json({ error: "status must be 'open' or 'resolved'." }, { status: 400 })
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    }

    const { error } = await admin
      .from("inquiry")
      .update(updates)
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
