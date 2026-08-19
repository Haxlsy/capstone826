import { GoogleGenAI } from "@google/genai"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  type ChatbotSettings,
  type ChatMessage,
  type ChatbotReply,
  type CustomerDetails,
} from "@/types/chatbot"

export type { ChatbotSettings, ChatMessage, ChatbotReply, CustomerDetails }

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_CHATBOT! })

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
const HARD_GUARDRAIL = `
ABSOLUTE RESTRICTIONS — these override everything else:
- You are ONLY an assistant for 826 Auto Care OPC. You have no other purpose.
- NEVER answer questions about code, programming, software, homework, assignments, math problems, general knowledge, current events, other businesses, or ANY topic unrelated to 826 Auto Care's services and operations.
- NEVER write code, scripts, essays, or help with academic/professional tasks.
- NEVER pretend to be a different AI or claim capabilities outside this scope.
- If a customer asks about anything outside 826 Auto Care, respond with exactly: "I can only assist with questions about 826 Auto Care's services. Is there anything I can help you with regarding our services?"
`.trim()

const PERSONALITY_PREAMBLE: Record<ChatbotSettings["personality"], string> = {
  friendly: "You are a friendly, warm, and professional AI assistant for 826 Auto Care OPC. Use a welcoming tone — conversational but still polished.",
  formal:   "You are a formal and concise AI assistant for 826 Auto Care OPC. Keep responses brief and professional.",
  casual:   "You are a casual and approachable AI assistant for 826 Auto Care OPC. Use everyday language and a relaxed tone.",
}

const ESCALATION_LABELS: Record<string, string> = {
  speak_to_human:    "customer asks to speak with a human",
  complaint:         "customer expresses a complaint or negative feedback",
  unanswerable:      "you cannot answer the customer's question",
  booking_confirmed: "the customer's booking request has been collected and forwarded to Sales",
}

/**
 * Settings-only system prompt. This is the exact prompt the admin
 * Chatbot Settings page persists into chatbot_config.system_prompt.
 */
export function buildSystemPrompt(s: ChatbotSettings): string {
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
    lines.push("1. Collect their Full Name, Contact Number, Plate Number, Vehicle Type, and Email.")
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

/**
 * Full runtime prompt used by the webhook and the admin preview:
 * settings + knowledge base + business facts + hard guardrail.
 */
export function buildFullSystemPrompt(
  settings: ChatbotSettings,
  knowledge?: string | null
): string {
  const parts = [buildSystemPrompt(settings)]

  if (knowledge && knowledge.trim()) {
    parts.push(`ADDITIONAL BUSINESS KNOWLEDGE (use this to answer accurately):\n${knowledge.trim()}`)
  }

  parts.push(BUSINESS_FACTS)
  parts.push(HARD_GUARDRAIL)
  return parts.join("\n\n")
}

/**
 * Assembles the runtime system prompt from whichever config source is
 * available. Used by both generateChatbotReply and extractCustomerDetails so
 * the two calls share a single prompt (no drift).
 */
function buildRuntimeSystemPrompt(
  settings?: ChatbotSettings | null,
  system_prompt?: string | null,
  knowledge?: string | null
): string {
  if (settings) {
    return buildFullSystemPrompt(settings, knowledge)
  }

  if (system_prompt) {
    const base = [system_prompt.trim(), BUSINESS_FACTS, HARD_GUARDRAIL].join("\n\n")
    return knowledge
      ? `${base}\n\nADDITIONAL BUSINESS KNOWLEDGE (use this to answer accurately):\n${knowledge.trim()}`
      : base
  }

  return buildFullSystemPrompt({
    personality: "friendly",
    enable_services: true,
    enable_booking: true,
    enable_status: true,
    enable_faq: true,
    booking_message: "A staff member will follow up with you to confirm your booking.",
    notify_sales: true,
    language: "english",
    escalation_rules: ["speak_to_human", "complaint", "unanswerable"],
    vehicle_status_template:
      "Please share your vehicle's plate number so I can check the current status of your job.",
  }, knowledge)
}

/** Loads the chatbot config row (settings + persisted system_prompt). */
export async function loadChatbotConfig() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("chatbot_config")
    .select("system_prompt, settings")
    .limit(1)
    .single()

  const settings =
    data?.settings && typeof data.settings === "object"
      ? (data.settings as ChatbotSettings)
      : null

  return {
    settings,
    system_prompt: data?.system_prompt ?? null,
  }
}

/** Loads all knowledge base entries as plain text for prompt injection. */
export async function loadKnowledgeBase(): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("chatbot_knowledge")
    .select("category, topic, content")
    .order("category")
    .order("topic")
    .order("created_at")

  if (error || !data || data.length === 0) return null

  return data
    .map((k) => `- [${k.category ?? "FAQ"}] ${k.topic}: ${k.content}`)
    .join("\n")
}

const HUMAN_REQUEST_PATTERNS = [
  /\bhuman\b/i,
  /\bagent\b/i,
  /\brepresentative\b/i,
  /\bcsr\b/i,
  /\bcustomer\s+service\b/i,
  /\bperson\b/i,
  /\bsomeone\b/i,
  /\bspeak\s+(to|with)\b/i,
  /\btalk\s+(to|with)\b/i,
  /\bmeet\b/i,
  /\bmanagers?\b/i,
  /\bstaff\b/i,
  /\btao\b/i,
  /\bkausap\b/i,
  /\bpakiusap\b/i,
  /\bmakiusap\b/i,
  /\bmagreklamo\b/i,
  /\bhindi\s+kaya\b/i,
]

/**
 * Cheap pre-check for an explicit "talk to a human" request,
 * evaluated before/alongside the AI's own escalation decision.
 */
export function requestedHuman(message: string): boolean {
  const normalized = message.toLowerCase()
  return HUMAN_REQUEST_PATTERNS.some((re) => re.test(normalized))
}

const BOOKING_INTENT_PATTERNS = [
  /\bbook(?:ing|ed)?\b/i,
  /\bmag-?book\b/i,
  /\bmagpa-?book\b/i,
  /\bpa-?book\b/i,
  /\breserv(?:e|ation|ed)\b/i,
  /\bsched(?:ule|uled|uling)?\b/i,
  /\bappointment\b/i,
  /\bpa(?:sched|iskedule)\b/i,
  /\bsign\s*up\b/i,
]

const STATUS_INTENT_PATTERNS = [
  /\bstatus\b/i,
  /\bupdate\b/i,
  /\bprogress\b/i,
  /\bas\s+of\b/i,
  /\bcheck\b/i,
  /\bsaan\s+na\b/i,
  /\bano\s+na\b/i,
  /\btapos\s+na\b/i,
  /\bgaano\s+na\b/i,
  /\bkumusta\s+(?:ang|na)\b/i,
  /\bbalak\s+ko\s+lang\s+itsek\b/i,
  /\bpaki-?(?:check|tingnan)\b/i,
]

/** True when the message expresses intent to book a service. */
export function hasBookingIntent(message: string): boolean {
  const normalized = message.toLowerCase()
  return BOOKING_INTENT_PATTERNS.some((re) => re.test(normalized))
}

const SEPARATE_BOOKING_PATTERNS = [
  /\banother\b/i,
  /\badditional\b/i,
  /\bseparate\b/i,
  /\bsecond\s+booking\b/i,
  /\bnew\s+booking\b/i,
  /\bisa\s+pang\b/i,
  /\bisa\s+pa\b/i,
  /\biba\s+pa\b/i,
  /\bpangalawa\b/i,
]

/**
 * True when the customer explicitly wants a separate, additional booking — used
 * to release the active-booking pause when a returning customer confirms they
 * are not just updating their current booking.
 */
export function wantsSeparateBooking(message: string): boolean {
  const normalized = message.toLowerCase()
  return SEPARATE_BOOKING_PATTERNS.some((re) => re.test(normalized))
}

/** True when the message asks for a vehicle-status update. */
export function hasStatusIntent(message: string): boolean {
  const normalized = message.toLowerCase()
  return STATUS_INTENT_PATTERNS.some((re) => re.test(normalized))
}

const CONFIRMATION_PATTERNS = [
  /\byes\b/i,
  /\byeah\b/i,
  /\byep\b/i,
  /\b(?:okay|ok)\b/i,
  /\bconfirm(?:ed)?\b/i,
  /\bcorrect\b/i,
  /\btama\b/i,
  /\btumpak\b/i,
  /\bopo\b/i,
  /\boo\b/i,
  /\bsige\b/i,
  /\bsure\b/i,
  /\bright\b/i,
]

/** True when the customer is confirming the collected booking details. */
export function confirmRequested(message: string): boolean {
  const normalized = message.toLowerCase()
  return CONFIRMATION_PATTERNS.some((re) => re.test(normalized))
}

const BOOKING_FIELDS: { key: keyof CustomerDetails; label: string }[] = [
  { key: "full_name",      label: "Full Name" },
  { key: "contact_number", label: "Contact Number" },
  { key: "plate_number",   label: "Plate Number" },
  { key: "vehicle_unit",   label: "Vehicle Type" },
  { key: "email",          label: "Email Address" },
]

/** True when the extracted details carry any booking field (booking-flow signal). */

/** Labels of the required booking fields still missing from the extracted details. */
export function missingBookingFields(
  details: CustomerDetails | null | undefined
): string[] {
  if (!details) return BOOKING_FIELDS.map((f) => f.label)
  return BOOKING_FIELDS.filter((f) => !details[f.key]).map((f) => f.label)
}

/**
 * True when a booking request is complete enough to confirm and hand over to
 * Sales. ALL five fields (full name, contact number, plate number, vehicle
 * type, email) must be captured. Extraction spans the full conversation
 * history, so details may accumulate across several turns before this flips.
 */
export function isCompleteBooking(details: CustomerDetails | null | undefined): boolean {
  return missingBookingFields(details).length === 0
}

/**
 * Generates a chatbot reply via Gemini with a structured JSON output
 * that also tells us whether the conversation should escalate to Sales.
 */
export async function generateChatbotReply(input: {
  message: string
  history?: ChatMessage[]
  settings?: ChatbotSettings | null
  system_prompt?: string | null
  knowledge?: string | null
  vehicleContext?: string | null
  bookingContext?: string | null
}): Promise<ChatbotReply> {
  const { message, history = [], settings, system_prompt, knowledge, vehicleContext, bookingContext } = input

  let systemPrompt = buildRuntimeSystemPrompt(settings, system_prompt, knowledge)

  // Inject authoritative vehicle-status data obtained via the internal lookup.
  if (vehicleContext && vehicleContext.trim()) {
    systemPrompt += `\n\nVEHICLE STATUS LOOKUP RESULT (authoritative — use this to answer, do not invent status data:\n${vehicleContext.trim()}`
  }

  // Inject authoritative booking-flow guidance (remind missing fields / await
  // confirmation) so the AI's reply matches the deterministic flow state.
  if (bookingContext && bookingContext.trim()) {
    systemPrompt += `\n\nBOOKING FLOW (authoritative — follow this over the generic booking instructions):\n${bookingContext.trim()}`
  }

  // Instruct the model to also surface any customer booking details it sees so
  // the webhook can store them in the inquiry's extracted_* columns. Even when
  // the reply escalates, the details must still be returned.
  systemPrompt += `\n\nAlways include any customer details you can identify from the conversation in the JSON "customer" object: full_name, contact_number, plate_number, vehicle_unit, and email. Leave any field you cannot determine as null. These are only noted for follow-up by our Sales team. Even when you escalate or answer with a short acknowledgement, you MUST still return every customer detail visible anywhere in the conversation in the "customer" object.`

  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [
    ...(history as ChatMessage[]).map((h) => ({
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
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          reply:    { type: "STRING" },
          escalate: { type: "BOOLEAN" },
          reason:   { type: "STRING" },
          customer: {
            type: "OBJECT",
            properties: {
              full_name:      { type: "STRING" },
              contact_number: { type: "STRING" },
              plate_number:   { type: "STRING" },
              vehicle_unit:   { type: "STRING" },
              email:          { type: "STRING" },
            },
            required: ["full_name", "contact_number", "plate_number", "vehicle_unit", "email"],
          },
        },
        required: ["reply", "escalate", "customer"],
      },
    },
  })

  const raw = response.text ?? ""

  try {
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?|```$/g, "").trim())
    const c = parsed.customer as Record<string, unknown> | null
    return {
      reply:    typeof parsed.reply === "string" ? parsed.reply : raw,
      escalate: Boolean(parsed.escalate),
      reason:   typeof parsed.reason === "string" ? parsed.reason : null,
      customer: c && typeof c === "object"
        ? {
            full_name:      typeof c.full_name === "string"      ? c.full_name      : null,
            contact_number: typeof c.contact_number === "string" ? c.contact_number : null,
            plate_number:   typeof c.plate_number === "string"   ? c.plate_number   : null,
            vehicle_unit:   typeof c.vehicle_unit === "string"   ? c.vehicle_unit   : null,
            email:          typeof c.email === "string"          ? c.email          : null,
          }
        : null,
    }
  } catch {
    return { reply: raw, escalate: false, reason: null, customer: null }
  }
}

/**
 * Focused second-pass extraction of customer booking details from a
 * conversation. Used on escalation when the main reply call did not return any
 * details. Runs a single Gemini call whose JSON schema is ONLY the customer
 * object, so the model cannot skip it. Returns null on any failure (never
 * throws into the webhook).
 */
export async function extractCustomerDetails(input: {
  message: string
  history?: ChatMessage[]
  settings?: ChatbotSettings | null
  system_prompt?: string | null
  knowledge?: string | null
}): Promise<CustomerDetails | null> {
  const { message, history = [], settings, system_prompt, knowledge } = input

  let systemPrompt = buildRuntimeSystemPrompt(settings, system_prompt, knowledge)
  systemPrompt += `\n\nExtract the customer's booking details from the conversation. Return them in the JSON "customer" object: full_name, contact_number, plate_number, vehicle_unit, and email. Leave any field you cannot determine as null. These are only noted for follow-up by our Sales team.`

  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [
    ...(history as ChatMessage[]).map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    { role: "user" as const, parts: [{ text: message.trim() }] },
  ]

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            customer: {
              type: "OBJECT",
              properties: {
                full_name:      { type: "STRING" },
                contact_number: { type: "STRING" },
                plate_number:   { type: "STRING" },
                vehicle_unit:   { type: "STRING" },
                email:          { type: "STRING" },
              },
              required: ["full_name", "contact_number", "plate_number", "vehicle_unit", "email"],
            },
          },
          required: ["customer"],
        },
      },
    })

    const raw = response.text ?? ""
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?|```$/g, "").trim())
    const c = parsed.customer as Record<string, unknown> | null
    if (!c || typeof c !== "object") return null

    return {
      full_name:      typeof c.full_name === "string"      ? c.full_name      : null,
      contact_number: typeof c.contact_number === "string" ? c.contact_number : null,
      plate_number:   typeof c.plate_number === "string"   ? c.plate_number   : null,
      vehicle_unit:   typeof c.vehicle_unit === "string"   ? c.vehicle_unit   : null,
      email:          typeof c.email === "string"          ? c.email          : null,
    }
  } catch {
    return null
  }
}
