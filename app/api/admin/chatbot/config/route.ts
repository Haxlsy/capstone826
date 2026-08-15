import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminCaller, type AdminCaller } from "@/lib/auth/guard"
import { auditCallerOf } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { buildSystemPrompt } from "@/lib/messenger/chatbot"
import { chatbotSettingsSchema, type ChatbotSettings } from "@/types/chatbot"

export async function GET() {
  const auth = await getAdminCaller()
  if ("error" in auth) return auth.error

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("chatbot_config")
    .select("id, system_prompt, settings, updated_at")
    .limit(1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}

export async function POST(request: Request) {
  const auth = await getAdminCaller()
  if ("error" in auth) return auth.error
  const { caller } = auth

  const body = await request.json()

  // Accept either legacy system_prompt string OR new settings object
  const isLegacy = typeof body.system_prompt === "string" && !body.settings

  if (isLegacy) {
    const { system_prompt } = body as { system_prompt: string }
    return saveRaw(system_prompt, null, caller)
  }

  const parsed = chatbotSettingsSchema.safeParse(body.settings)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const settings = parsed.data
  const system_prompt = buildSystemPrompt(settings)
  return saveRaw(system_prompt, settings, caller)
}

async function saveRaw(
  system_prompt: string,
  settings: ChatbotSettings | null,
  caller: AdminCaller
) {
  const supabase = createAdminClient()

  const { data: config } = await supabase
    .from("chatbot_config")
    .select("id")
    .limit(1)
    .single()

  if (!config) return NextResponse.json({ error: "Config not found." }, { status: 404 })

  const updates: Record<string, unknown> = {
    system_prompt,
    updated_by_id: caller.user.id,
    updated_at:    new Date().toISOString(),
  }
  if (settings !== null) updates.settings = settings

  const { error } = await supabase
    .from("chatbot_config")
    .update(updates)
    .eq("id", config.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAuditCall(auditCallerOf(caller), {
    category: "update",
    action:   settings ? "Updated chatbot settings" : "Updated chatbot system prompt",
  })

  return NextResponse.json({ success: true })
}