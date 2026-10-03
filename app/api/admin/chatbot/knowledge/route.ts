import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminCaller } from "@/lib/auth/guard"
import { auditCallerOf } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
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

  // Same name is fine across categories (e.g. "PPF" under Service and "PPF"
  // under Pricing are two different entries) — but not twice within one.
  const { data: existing, error: existingErr } = await supabase
    .from("chatbot_knowledge")
    .select("topic")
    .eq("category", category)

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })

  const normalized = topic.toLowerCase()
  if ((existing ?? []).some((e) => e.topic.toLowerCase() === normalized)) {
    return NextResponse.json(
      { error: `"${topic}" already exists in the ${category} category. Use a different name, or edit the existing entry.` },
      { status: 409 },
    )
  }

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

  await logAuditCall(auditCallerOf(caller), {
    category: "create",
    action:   "Added knowledge entry",
    target:   topic,
  })

  return NextResponse.json({ entry: data }, { status: 201 })
}