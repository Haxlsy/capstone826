import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"

interface ChatbotSettings {
  personality:      "friendly" | "formal" | "casual"
  enable_services:  boolean
  enable_booking:   boolean
  enable_status:    boolean
  enable_faq:       boolean
  booking_message:  string
  notify_sales:     boolean
  language:                "english" | "filipino" | "both"
  escalation_rules:        string[]
  vehicle_status_template: string
}

const PERSONALITY_PREAMBLE: Record<ChatbotSettings["personality"], string> = {
  friendly: "You are a friendly, warm, and professional AI assistant for 826 Auto Care OPC. Use a welcoming tone — conversational but still polished.",
  formal:   "You are a formal and concise AI assistant for 826 Auto Care OPC. Keep responses brief and professional.",
  casual:   "You are a casual and approachable AI assistant for 826 Auto Care OPC. Use everyday language and a relaxed tone.",
}

const ESCALATION_LABELS: Record<string, string> = {
  speak_to_human:     "customer asks to speak with a human",
  complaint:          "customer expresses a complaint or negative feedback",
  unanswerable:       "you cannot answer the customer's question",
  booking_confirmed:  "the customer's booking request has been collected and forwarded to Sales",
}

function buildSystemPrompt(s: ChatbotSettings): string {
  const lines: string[] = []

  lines.push(PERSONALITY_PREAMBLE[s.personality] ?? PERSONALITY_PREAMBLE.friendly)
  lines.push("")
  lines.push("You can help customers with:")

  if (s.enable_services) lines.push("- Information about 826 Auto Care's services and pricing")
  if (s.enable_faq)      lines.push("- General FAQs about detailing and installation")
  if (s.enable_status)   lines.push("- Checking the current status of their vehicle's service job")
  if (s.enable_booking)  lines.push("- Collecting their details for a booking request")

  if (s.enable_booking) {
    lines.push("")
    lines.push("When a customer wants to book a service:")
    lines.push("1. Collect their Full Name, Contact Number, Plate Number, and Vehicle Type.")
    lines.push("2. Confirm the details with the customer.")
    lines.push(`3. Send them this message exactly: "${s.booking_message}"`)
    if (s.notify_sales) {
      lines.push("4. The system will automatically notify the Sales team with the customer's details.")
    }
    lines.push("IMPORTANT: You do NOT confirm or schedule bookings. You only collect information.")
  }

  if (s.enable_status) {
    lines.push("")
    lines.push("When a customer asks about their vehicle status:")
    lines.push("1. Send them this exact message to collect their details:")
    lines.push("---")
    lines.push(s.vehicle_status_template)
    lines.push("---")
    if (s.language === "filipino") {
      lines.push("Translate the above message to natural Filipino (Tagalog) before sending it.")
    }
    lines.push("2. Once they provide their plate number, use the vehicle-status lookup tool to find their active job order.")
    lines.push("3. Share the current status clearly and politely.")
    lines.push("4. If no active job is found, let them know and offer to help further.")
  }

  lines.push("")
  if (s.language === "filipino") {
    lines.push("LANGUAGE: Always respond in Filipino (Tagalog). Use natural, conversational Filipino throughout every message.")
  } else {
    lines.push("LANGUAGE: Always respond in English.")
  }

  if (s.escalation_rules.length > 0) {
    lines.push("")
    lines.push("Immediately escalate to a human staff member if:")
    for (const rule of s.escalation_rules) {
      const label = ESCALATION_LABELS[rule]
      if (label) lines.push(`- The ${label}`)
    }
  }

  return lines.join("\n")
}

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
