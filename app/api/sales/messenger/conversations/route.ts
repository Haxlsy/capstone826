import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { getConversations } from "@/lib/messenger/messenger-data"

// GET /api/sales/messenger/conversations?status=pending|closed
// Returns escalated conversations only (pending + closed by default).
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const status = new URL(request.url).searchParams.get("status")
    const { conversations } = await getConversations({
      status: status === "pending" || status === "closed" ? status : undefined,
    })

    return NextResponse.json({ conversations })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
