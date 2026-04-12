import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const body = await request.json()
  const updates: Record<string, string> = {}
  if (body.topic)   updates.topic   = body.topic
  if (body.content) updates.content = body.content

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("chatbot_knowledge")
    .update(updates)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("chatbot_knowledge")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
