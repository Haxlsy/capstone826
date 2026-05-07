import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { createAdminClient } from "@/lib/supabase/admin"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_CHATBOT! })

interface HistoryItem {
  role: "user" | "model"
  text: string
}

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

// Business facts — always injected so the AI answers accurately.
const BUSINESS_FACTS = `
BUSINESS INFORMATION:
- Business name: 826 Auto Aesthetic and Protection (also known as 826 Auto Care OPC)
- Location: H4JG+HV8, Ortigas Ave Ext, Cainta, 1900 Rizal, Philippines
- Business hours: Tuesday to Sunday, 8:00 AM – 8:00 PM. Closed on Mondays and public holidays.
- Always state these hours exactly when a customer asks about business hours or operating hours.

ABOUT THE COMPANY:
826 Auto Aesthetic and Protection is a proudly Filipino-owned automotive care company committed to delivering premium detailing, protection, and enhancement services for all types of vehicles. Known for quality, innovation, and a customer-first approach, 826 specializes in PPF installation, graphene coatings, interior leather care, windshield protection, and full auto detailing. With skilled professionals and cutting-edge tools, 826 goes beyond standard car care — protecting every vehicle as if it were our own.

LIST OF SERVICES:

Auto Detailing:
- Exterior Detailing – Deep cleaning, polishing, and waxing to restore and protect the car's exterior.
- Interior Detailing – Full cleaning of seats, carpets, and hard surfaces; includes vacuuming, shampooing, and leather care.

Coating Services:
- Ceramic/Graphene Coating – Long-lasting, high-gloss finish with strong protection against water spots, UV, and chemical damage.
- Borophene Coating – Advanced coating technology for enhanced gloss and chemical resistance.
- Interior Leather Coating – Protects leather from stains, cracks, and fading while preserving its natural feel.

Paint Protection Film (PPF):
- Full Body PPF – Transparent or colored film that protects paint from scratches, chips, and swirl marks.
- Per Panel PPF – Specific panel protection for high-impact areas (hood, bumper, side mirrors, etc.).
- Windshield PPF – Adds an invisible shield to the windshield to resist chips and cracks.

Nano Ceramic Tint:
- Provides advanced heat rejection, UV protection, and glare reduction while maintaining clear visibility. Blocks harmful rays and enhances interior comfort without affecting signal reception.
`.trim()

// Hard guardrail — always prepended regardless of user config.
// Prevents the AI from answering anything unrelated to 826 Auto Care.
const HARD_GUARDRAIL = `
ABSOLUTE RESTRICTIONS — these override everything else:
- You are ONLY an assistant for 826 Auto Care OPC. You have no other purpose.
- NEVER answer questions about code, programming, software, homework, assignments, math problems, general knowledge, current events, other businesses, or ANY topic unrelated to 826 Auto Care's services and operations.
- NEVER write code, scripts, essays, or help with academic/professional tasks.
- NEVER pretend to be a different AI or claim capabilities outside this scope.
- If a customer asks about anything outside 826 Auto Care, respond with exactly: "I can only assist with questions about 826 Auto Care's services. Is there anything I can help you with regarding our services?"
`.trim()

const PERSONALITY_PREAMBLE: Record<ChatbotSettings["personality"], string> = {
  friendly: "You are a friendly, warm, and professional AI assistant for 826 Auto Care OPC — a vehicle detailing and installation shop. Use a welcoming tone that is conversational but still polished.",
  formal:   "You are a formal and concise AI assistant for 826 Auto Care OPC — a vehicle detailing and installation shop. Keep responses brief and professional.",
  casual:   "You are a casual and approachable AI assistant for 826 Auto Care OPC — a vehicle detailing and installation shop. Use everyday language and a relaxed tone.",
}

const ESCALATION_LABELS: Record<string, string> = {
  speak_to_human: "the customer asks to speak with a human",
  complaint:      "the customer expresses a complaint or negative feedback",
  unanswerable:   "you cannot answer the customer's question",
}

function buildPromptFromSettings(s: ChatbotSettings): string {
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
    lines.push(`3. Tell them: "${s.booking_message}"`)
    lines.push("IMPORTANT: You do NOT confirm or schedule bookings — you only collect the information.")
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
    lines.push("2. Once they provide their plate number, look it up and share the current status.")
    lines.push("3. If no active job is found, let them know and offer to help further.")
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
      if (label) lines.push(`- ${label}`)
    }
  }

  lines.push("")
  lines.push(BUSINESS_FACTS)
  lines.push("")
  lines.push(HARD_GUARDRAIL)

  return lines.join("\n")
}

export async function POST(request: Request) {
  try {
    const { message, history = [], settings } = (await request.json()) as {
      message: string
      history: HistoryItem[]
      settings?: ChatbotSettings
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required." }, { status: 400 })
    }

    let systemPrompt: string

    if (settings) {
      // Use live settings passed from the UI — no DB read needed
      systemPrompt = buildPromptFromSettings(settings)
    } else {
      // Fallback: read saved system_prompt from DB
      const supabase = createAdminClient()
      const { data: config } = await supabase
        .from("chatbot_config")
        .select("system_prompt")
        .limit(1)
        .single()

      systemPrompt =
        (config?.system_prompt ? `${config.system_prompt}\n\n${BUSINESS_FACTS}\n\n${HARD_GUARDRAIL}` : null) ??
        `You are a helpful AI assistant for 826 Auto Care OPC, a vehicle detailing and installation shop.\n\n${BUSINESS_FACTS}\n\n${HARD_GUARDRAIL}`
    }

    const contents = [
      ...(history as HistoryItem[]).map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      })),
      { role: "user" as const, parts: [{ text: message.trim() }] },
    ]

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 512,
      },
    })

    return NextResponse.json({ reply: response.text ?? "" })
  } catch (err: unknown) {
    console.error("[chatbot-preview]", err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
