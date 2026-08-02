import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { getConversationMessages } from "@/lib/messenger/messenger-data"

// GET /api/sales/messenger/conversations/[id]/messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const conversationId = Number(id)
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messages } = await getConversationMessages(conversationId)
    return NextResponse.json({ messages })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
