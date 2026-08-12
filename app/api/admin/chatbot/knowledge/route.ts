import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminCaller } from "@/lib/auth/guard"
import { logAudit } from "@/hooks/audit-helpers"
import { kbCreateSchema } from "@/types/chatbot"

export async function GET() {
  const auth = await getAdminCaller()
  if ("error" in auth) return auth.error

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("chatbot_knowledge")
    .select("id, category, topic, content, created_at, updated_at")
    .order("category")
    .order("topic")
    .order("created_at")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await getAdminCaller()
  if ("error" in auth) return auth.error
  const { caller } = auth

  const body = await request.json()
  const parsed = kbCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { topic, content, category } = parsed.data
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
    .insert({ chatbot_config_id: config.id, topic, content, category })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAudit({
    user_id:   caller.user.id,
    user_name: caller.profile.full_name,
    role:      caller.profile.role,
    category:  "create",
    action:    "Added knowledge entry",
    target:    topic,
  })

  return NextResponse.json({ entry: data }, { status: 201 })
}