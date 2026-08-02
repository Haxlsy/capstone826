import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { buildSystemPrompt, type ChatbotSettings } from "@/lib/messenger/chatbot"

export async function GET() {
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
  const body = await request.json()

  // Accept either legacy system_prompt string OR new settings object
  const isLegacy = typeof body.system_prompt === "string" && !body.settings

  if (isLegacy) {
    // Fallback: raw system_prompt save (keeps Knowledge Base tab working if needed)
    const { system_prompt } = body as { system_prompt: string }
    return saveRaw(system_prompt)
  }

  const settings = body.settings as ChatbotSettings
  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "settings object is required." }, { status: 400 })
  }

  const system_prompt = buildSystemPrompt(settings)
  return saveRaw(system_prompt, settings)
}

async function saveRaw(system_prompt: string, settings?: ChatbotSettings) {
  const cookieStore = await cookies()
  const userClient = createClient(cookieStore)
  const { data: { user } } = await userClient.auth.getUser()

  const supabase = createAdminClient()

  const { data: config } = await supabase
    .from("chatbot_config")
    .select("id")
    .limit(1)
    .single()

  if (!config) return NextResponse.json({ error: "Config not found." }, { status: 404 })

  const updates: Record<string, unknown> = {
    system_prompt,
    updated_by_id: user?.id ?? null,
    updated_at:    new Date().toISOString(),
  }
  if (settings !== undefined) updates.settings = settings

  const { error } = await supabase
    .from("chatbot_config")
    .update(updates)
    .eq("id", config.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (user) {
    const { data: prof } = await supabase.from("user_account").select("full_name, role").eq("id", user.id).single()
    if (prof) {
      logAudit({
        user_id:   user.id,
        user_name: prof.full_name,
        role:      prof.role,
        category:  "update",
        action:    settings ? "Updated chatbot settings" : "Updated chatbot system prompt",
      })
    }
  }

  return NextResponse.json({ success: true })
}
