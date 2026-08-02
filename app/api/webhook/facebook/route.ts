import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getOrCreateConversationByPsid,
  insertMessage,
  setConversationStatus,
  getConversationHistory,
} from "@/lib/messenger/messenger-data"
import {
  loadChatbotConfig,
  loadKnowledgeBase,
  generateChatbotReply,
  requestedHuman,
} from "@/lib/messenger/chatbot"
import { sendMessengerText, fetchMessengerProfile } from "@/lib/messenger/graph"

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

interface MessengerEvent {
  sender?: { id?: string }
  recipient?: { id?: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    attachments?: unknown[]
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

  // Get or create the conversation and capture its current status.
  const { conversation_id, status } = await getOrCreateConversationByPsid(
    senderId,
    profile.name
  )

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

  // AI auto-reply + escalation decision.
  const humanRequested = requestedHuman(messageBody)

  let reply: string | null = null
  let escalate = humanRequested
  let escalateReason: string | null = humanRequested
    ? "customer asked to speak with a human"
    : null

  try {
    const [{ settings, system_prompt }, knowledge] = await Promise.all([
      loadChatbotConfig(),
      loadKnowledgeBase(),
    ])

    const result = await generateChatbotReply({
      message: messageBody,
      history,
      settings,
      system_prompt,
      knowledge,
    })

    reply = result.reply?.trim() || null
    escalate = result.escalate || humanRequested
    escalateReason = humanRequested ? "customer asked to speak with a human" : (result.reason ?? null)
  } catch (err) {
    // If the AI fails, err on the side of escalating to a human.
    console.error("[webhook/facebook] chatbot error:", err)
    escalate = true
    escalateReason = "chatbot error"
  }

  if (escalate) {
    await setConversationStatus(conversation_id, "pending")

    // Inquiry record (only on escalation) so Inquiry Management keeps working.
    const inquiry_type = humanRequested ? "Human Response" : "Booking"
    const { error: inquiryErr } = await admin.from("inquiry").insert({
      messenger_name: profile.name,
      psid: senderId,
      inquiry_type,
      status: "open",
      escalated_at: timestamp,
      last_message: messageBody,
    })
    if (inquiryErr) console.error("[webhook/facebook] inquiry insert failed:", inquiryErr.message)

    // Acknowledge to the customer that a human will follow up.
    const fbId = await sendMessengerText(senderId, ESCALATION_ACK)
    await insertMessage({
      conversation_id,
      sender_type: "agent",
      message_body: ESCALATION_ACK,
      sent_at: new Date().toISOString(),
      fb_message_id: fbId,
    })
    return
  }

  // Not escalated → send the AI reply.
  if (reply) {
    const fbId = await sendMessengerText(senderId, reply)
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
