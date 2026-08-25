import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("notification")
      .select(`
        id, type, message, job_order_id, stage_id, is_read, created_at,
        job:job_order_id(plate_number)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { count: unreadCount } = await supabase
      .from("notification")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    const shaped = (data ?? []).map((n: any) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      job_order_id: n.job_order_id,
      stage_id: n.stage_id,
      plate_number: n.job?.plate_number ?? null,
      is_read: n.is_read,
      created_at: n.created_at,
    }))

    return NextResponse.json({ notifications: shaped, unreadCount: unreadCount ?? 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function PATCH() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase
      .from("notification")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
