import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/push/send"

// POST /api/push/test — sends the current user a test push notification, for
// the "Send Test Notification" button in Settings > Notifications. Always
// targets the caller's own id (resolved from cookies), never a client-supplied one.
export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()
    const { count } = await admin
      .from("push_subscription")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (!count) {
      return NextResponse.json(
        { error: "No active push subscription on this device yet. Enable notifications first." },
        { status: 400 }
      )
    }

    await sendPushToUser(user.id, {
      title: "826 Test Notification",
      body: "If you can see this, push notifications are working on this device! 🎉",
      url: "/head-technician/settings",
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
