import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("chatbot_knowledge")
    .select("id, topic, content, created_at, updated_at")
    .order("topic")
    .order("created_at")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { topic, content } = body

  if (!topic || !content) {
    return NextResponse.json({ error: "topic and content are required." }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Get the config row id to link the entry
  const { data: config } = await supabase
    .from("chatbot_config")
    .select("id")
    .limit(1)
    .single()

  if (!config) return NextResponse.json({ error: "Chatbot config not found." }, { status: 500 })

  const { data, error } = await supabase
    .from("chatbot_knowledge")
    .insert({ chatbot_config_id: config.id, topic, content })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data }, { status: 201 })
}
