import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getOrCreateConversationByPsid,
  insertMessage,
  setConversationStatus,
  setVehicleInquiry,
  getConversationHistory,
} from "@/lib/messenger/messenger-data"
import {
  loadChatbotConfig,
  loadKnowledgeBase,
  generateChatbotReply,
  extractCustomerDetails,
  requestedHuman,
  hasBookingIntent,
  hasStatusIntent,
  isCompleteBooking,
  type ChatbotReply,
  type CustomerDetails,
} from "@/lib/messenger/chatbot"
import {
  sendMessengerText,
  sendMessengerQuickReply,
  fetchMessengerProfile,
  type MessengerQuickReply,
} from "@/lib/messenger/graph"
import { lookupVehicleStatus, formatVehicleStatus } from "@/lib/messenger/vehicle"

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN!

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode")
  const token = req.nextUrl.searchParams.get("hub.verify_token")
  const challenge = req.nextUrl.searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return new Response("Forbidden", { status: 403 })
}

const ESCALATION_ACK =
  "A member of our team will assist you shortly. Thank you for reaching out to 826 Auto Care!"

// Report-type concern keywords used by the escalation-type resolver.
const REPORT_PATTERNS = [
  /\breport\b/i,
  /\bcomplaint\b/i,
  /\bconcern\b/i,
  /\breklamo\b/i,
  /\bproblema\b/i,
  /\bissue\b/i,
]

const QUICK_REPLIES: MessengerQuickReply[] = [
  { content_type: "text", title: "Services & Prices", payload: "services" },
  { content_type: "text", title: "Booking",           payload: "booking"  },
  { content_type: "text", title: "Report a Concern",  payload: "report"   },
  { content_type: "text", title: "Vehicle Status",    payload: "status"   },
]

// Loose PH plate-number pattern (e.g. ABC 1234, XYZ-567, 1234 ABC).
const PLATE_PATTERN = /\b[A-Z]{1,4}\s?-?\s?\d{1,6}(?:\s?-\s?[A-Z]{1,2})?\b/i

// Loose Philippine mobile-number pattern (e.g. 0917 555 0101, +639175550101).
const PHONE_PATTERN = /(?:\+?63|0)\s?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/

interface MessengerEvent {
  sender?: { id?: string }
  recipient?: { id?: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    attachments?: unknown[]
    quick_reply?: { payload?: string }
  }
  delivery?: unknown
  read?: unknown
  postback?: unknown
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ received: false, error: "Invalid JSON" }, { status: 400 })
  }

  const events: MessengerEvent[] = (body.entry ?? []).flatMap(
    (entry: any) => entry?.messaging ?? []
  )

  const admin = createAdminClient()
  let handled = 0

  for (const messaging of events) {
    // Skip delivery / read / postback callbacks and echoed bot messages.
    if (!messaging || messaging.delivery || messaging.read || messaging.postback) continue
    const msg = messaging.message
    if (!msg || msg.is_echo) continue

    const senderId = messaging.sender?.id
    if (!senderId) continue

    try {
      await handleInboundMessage(admin, messaging)
      handled += 1
    } catch (err) {
      console.error("[webhook/facebook] event failed:", err)
    }
  }

  return NextResponse.json({ received: true, handled })
}

async function handleInboundMessage(
  admin: ReturnType<typeof createAdminClient>,
  messaging: MessengerEvent
) {
  const senderId = messaging.sender!.id!
  const timestamp = new Date(messaging.timestamp ?? Date.now()).toISOString()
  const msg = messaging.message!

  const text = (msg.text ?? "").trim()
  const hasAttachment = Array.isArray(msg.attachments) && msg.attachments.length > 0
  const messageBody = text || (hasAttachment ? "[Attachment]" : "")
  if (!messageBody) return

  const profile = await fetchMessengerProfile(senderId)

  // Get or create the conversation and capture its current status + flow flag.
  const { conversation_id, status, is_vehicle_inquiry } =
    await getOrCreateConversationByPsid(senderId, profile.name)

  // Build AI history BEFORE inserting the current message.
  const history = await getConversationHistory(conversation_id)

  await insertMessage({
    conversation_id,
    sender_type: "customer",
    message_body: messageBody,
    sent_at: timestamp,
    fb_message_id: msg.mid ?? null,
  })

  // If the conversation is already escalated, Sales is handling it —
  // just record the message, do not auto-reply.
  if (status === "pending") return

  const quickReplyPayload = msg.quick_reply?.payload ?? null

  // Intent detection. Status intent always wins over booking intent: a status
  // lookup is read-only and non-destructive, so checking it first is safe.
  const bookingIntent =
    quickReplyPayload === "booking" || hasBookingIntent(messageBody)
  const statusIntent =
    quickReplyPayload === "status" ||
    hasStatusIntent(messageBody) ||
    (!bookingIntent && is_vehicle_inquiry)

  // Persist which flow the conversation is in so a bare follow-up reply
  // (e.g. just a plate + phone after the status template) stays on the same
  // track without needing the keyword repeated.
  try {
    if (statusIntent) {
      await setVehicleInquiry(conversation_id, true)
    } else if (bookingIntent) {
      await setVehicleInquiry(conversation_id, false)
    }
  } catch (err) {
    console.error("[webhook/facebook] setVehicleInquiry failed:", err)
  }

  // Vehicle-status context: run the lookup whenever a plate is present UNLESS
  // this message has explicit booking intent (booking details include a plate
  // but must not drag in status context). Bare plate+phone with no keyword is
  // still honored as a status request, matching current behavior and the scope
  // (non-Messenger customers verify identity via plate + phone).
  const plateMatch = messageBody.match(PLATE_PATTERN)
  const phoneMatch = messageBody.match(PHONE_PATTERN)
  let vehicleContext: string | null = null
  if (plateMatch?.[0] && !bookingIntent) {
    const lookup = await lookupVehicleStatus({
      plate: plateMatch[0],
      phone: phoneMatch?.[0] ?? null,
      psid: senderId,
    })
    vehicleContext = formatVehicleStatus(lookup)
  }

  // AI auto-reply + escalation decision.
  const humanRequested = requestedHuman(messageBody)

  let reply: string | null = null
  let escalate = humanRequested
  let escalateReason: string | null = humanRequested
    ? "customer asked to speak with a human"
    : null
  let aiReason: string | null = null
  let extracted: ChatbotReply["customer"] = null
  let settings: Awaited<ReturnType<typeof loadChatbotConfig>>["settings"] = null
  let system_prompt: string | null = null
  let knowledge: string | null = null

  try {
    const [{ settings: loadedSettings, system_prompt: loadedPrompt }, loadedKnowledge] =
      await Promise.all([
        loadChatbotConfig(),
        loadKnowledgeBase(),
      ])
    settings = loadedSettings
    system_prompt = loadedPrompt
    knowledge = loadedKnowledge

    const result = await generateChatbotReply({
      message: messageBody,
      history,
      settings,
      system_prompt,
      knowledge,
      vehicleContext,
    })

    reply = result.reply?.trim() || null
    escalate = result.escalate || humanRequested
    escalateReason = humanRequested ? "customer asked to speak with a human" : (result.reason ?? null)
    aiReason = result.reason ?? null
    extracted = result.customer ?? null
  } catch (err) {
    // If the AI fails, err on the side of escalating to a human.
    console.error("[webhook/facebook] chatbot error:", err)
    escalate = true
    escalateReason = "chatbot error"
  }

  if (escalate) {
    await setConversationStatus(conversation_id, "pending")

    // If the main reply call produced no customer details (e.g. the model
    // skipped the customer object under escalation pressure), run a focused
    // second-pass extraction so the inquiry's extracted_* fields are filled.
    const hasDetails = (c: CustomerDetails | null | undefined): boolean =>
      Boolean(
        c &&
        (c.full_name || c.contact_number || c.plate_number || c.vehicle_unit || c.email)
      )
    if (!hasDetails(extracted)) {
      try {
        const fallback = await extractCustomerDetails({
          message: messageBody,
          history,
          settings,
          system_prompt,
          knowledge,
        })
        if (hasDetails(fallback)) extracted = fallback
      } catch (err) {
        console.error("[webhook/facebook] extraction fallback failed:", err)
      }
    }

    // Inquiry record (only on escalation) so Inquiry Management keeps working.
    // Any customer details the AI identified are stored in extracted_* columns.
    //
    // Escalation type priority:
    //   1. Customer explicitly asked for a human          → Human Response
    //   2. Booking details are complete (or AI confirmed) → Booking
    //   3. Customer reported a concern/complaint          → Report
    //   4. Anything else                                  → Human Response
    let inquiry_type: "Booking" | "Human Response" | "Report"
    if (humanRequested) {
      inquiry_type = "Human Response"
    } else if (aiReason === "booking_confirmed" || isCompleteBooking(extracted)) {
      inquiry_type = "Booking"
    } else if (REPORT_PATTERNS.some((re) => re.test(messageBody))) {
      inquiry_type = "Report"
    } else {
      inquiry_type = "Human Response"
    }

    const { error: inquiryErr } = await admin.from("inquiry").insert({
      messenger_name: profile.name,
      psid: senderId,
      inquiry_type,
      status: "open",
      escalated_at: timestamp,
      last_message: messageBody,
      extracted_name:    extracted?.full_name      ?? null,
      extracted_contact: extracted?.contact_number ?? null,
      extracted_plate:   extracted?.plate_number   ?? null,
      extracted_vehicle: extracted?.vehicle_unit   ?? null,
      extracted_email:   extracted?.email          ?? null,
    })
    if (inquiryErr) console.error("[webhook/facebook] inquiry insert failed:", inquiryErr.message)

    // Booking requests first receive the configured confirmation message, then
    // the escalation ack — the customer knows their booking was received before
    // being told a human will follow up.
    if (inquiry_type === "Booking" && settings?.booking_message) {
      const confirmId = await sendMessengerText(senderId, settings.booking_message)
      await insertMessage({
        conversation_id,
        sender_type: "agent",
        message_body: settings.booking_message,
        sent_at: new Date().toISOString(),
        fb_message_id: confirmId,
      })
    }

    // Acknowledge to the customer that a human will follow up (no quick replies —
    // a human now owns the thread).
    const fbId = await sendMessengerText(senderId, ESCALATION_ACK)
    await insertMessage({
      conversation_id,
      sender_type: "agent",
      message_body: ESCALATION_ACK,
      sent_at: new Date().toISOString(),
      fb_message_id: fbId,
    })

    // Escalated threads are now owned by Sales; leave any status flow.
    try {
      await setVehicleInquiry(conversation_id, false)
    } catch (err) {
      console.error("[webhook/facebook] setVehicleInquiry reset failed:", err)
    }
    return
  }

  // Not escalated → send the AI reply. Attach the quick-reply menu unless this
  // inbound was itself a quick-reply tap (answer it plainly, menu returns on
  // the next free-text message).
  if (reply) {
    const fbId = quickReplyPayload
      ? await sendMessengerText(senderId, reply)
      : await sendMessengerQuickReply(senderId, reply, QUICK_REPLIES)
    await insertMessage({
      conversation_id,
      sender_type: "agent",
      message_body: reply,
      sent_at: new Date().toISOString(),
      fb_message_id: fbId,
    })
    // Re-open (or keep open) so the chat stays out of the Sales view.
    await setConversationStatus(conversation_id, "open")
  }
}
