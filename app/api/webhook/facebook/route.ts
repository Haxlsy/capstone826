import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getOrCreateConversationByPsid,
  insertMessage,
  setConversationStatus,
  setVehicleInquiry,
  setBookingFlow,
  setAwaitingConfirmation,
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
  missingBookingFields,
  confirmRequested,
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

// Booking-flow context for the confirmation prompt: summarize the collected
// details and ask the customer to confirm before the booking is escalated.
const CONFIRM_BOOKING_CONTEXT =
  "All required booking details are collected (Full Name, Contact Number, Plate Number, Vehicle Type, Email). " +
  "Summarize the details back to the customer and ask them to confirm, phrased in the customer's configured language like: " +
  "'Is this information correct? Reply YES to confirm.' " +
  "Do NOT send the final booking confirmation message and do NOT escalate until the customer confirms."

// Report-type concern keywords used by the escalation-type resolver.
// Deliberately excludes "problema"/"issue" so casual phrases like
// "walang problema" (no problem) do not trigger a report escalation.
const REPORT_PATTERNS = [
  /\breport\b/i,
  /\bcomplaint\b/i,
  /\bconcern\b/i,
  /\breklamo\b/i,
  /\bmagreklamo\b/i,
]

const QUICK_REPLIES: MessengerQuickReply[] = [
  { content_type: "text", title: "Services & Prices", payload: "services" },
  { content_type: "text", title: "Booking",           payload: "booking"  },
  { content_type: "text", title: "Report a Concern",  payload: "report"   },
  { content_type: "text", title: "Vehicle Status",    payload: "status"   },
]

/** True when the extracted customer object carries at least one real detail. */
const hasExtractedDetails = (c: CustomerDetails | null | undefined): boolean =>
  Boolean(
    c &&
    (c.full_name || c.contact_number || c.plate_number || c.vehicle_unit || c.email)
  )

// Loose PH plate-number pattern (e.g. ABC 1234, XYZ-567, 1234 ABC).
const PLATE_PATTERN = /\b[A-Z]{1,4}\s?-?\s?\d{1,6}(?:\s?-\s?[A-Z]{1,2})?\b/i

// Loose Philippine mobile-number pattern (e.g. 0917 555 0101, +639175550101).
const PHONE_PATTERN = /(?:\+?63|0)\s?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/

// Loose email pattern (e.g. john@example.com).
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/

// A message carries a booking signal when it either states booking intent or
// contains one of the booking detail tokens (plate / phone / email). This is
// evaluated on the CURRENT message only, so a stray detail from an older turn
// does not keep the confirmation flow glued to unrelated replies.
const bookingSignal = (text: string): boolean =>
  hasBookingIntent(text) || PLATE_PATTERN.test(text) || PHONE_PATTERN.test(text) || EMAIL_PATTERN.test(text)

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

  // Get or create the conversation and capture its current status + flow flags.
  const { conversation_id, status, is_vehicle_inquiry, is_booking_flow, awaiting_confirmation } =
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

  // A message carries a booking signal when it states booking intent or
  // contains a booking detail token (plate / phone / email).
  const signal = bookingSignal(messageBody)

  // Persist which flow the conversation is in so a bare follow-up reply
  // (e.g. just a plate + phone after the status template, or a vehicle type
  // that completes a booking) stays on the same track without needing the
  // keyword repeated.
  try {
    if (statusIntent) {
      await setVehicleInquiry(conversation_id, true)
      await setBookingFlow(conversation_id, false)
    } else if (bookingIntent || signal) {
      await setVehicleInquiry(conversation_id, false)
      await setBookingFlow(conversation_id, true)
    }
  } catch (err) {
    console.error("[webhook/facebook] flow persistence failed:", err)
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
  const reportIntent =
    quickReplyPayload === "report" ||
    REPORT_PATTERNS.some((re) => re.test(messageBody))

  let reply: string | null = null
  let escalate = humanRequested || reportIntent
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
    escalate = result.escalate || humanRequested || reportIntent
    escalateReason = humanRequested ? "customer asked to speak with a human" : (result.reason ?? null)
    aiReason = result.reason ?? null
    extracted = result.customer ?? null
  } catch (err) {
    // If the AI fails, err on the side of escalating to a human.
    console.error("[webhook/facebook] chatbot error:", err)
    escalate = true
    escalateReason = "chatbot error"
  }

  // Booking flow: deterministic remind → confirm → escalate. This overrides the
  // AI's own escalate flag so a completed booking is never finalized before the
  // customer confirms their details, and missing fields are called out.
  //
  // The flow fires when the CURRENT message carries a booking signal
  // (booking intent / a detail token), the conversation is flagged as being in
  // a booking flow (is_booking_flow was persisted by an earlier turn), OR the
  // customer is still on the confirmation step (awaiting_confirmation was
  // persisted by a previous turn). Persisting is_booking_flow keeps the flow
  // engaged across detail-collection turns whose final detail (e.g. a vehicle
  // type like "Ford") carries no booking signal of its own.
  const bookingFlow = signal || is_booking_flow || awaiting_confirmation
  let escalateBooking = false

  // Best-effort flag persistence: a failure here should not abort the reply.
  const persistConfirmFlag = async (value: boolean) => {
    try {
      await setAwaitingConfirmation(conversation_id, value)
    } catch (err) {
      console.error("[webhook/facebook] setAwaitingConfirmation failed:", err)
    }
  }
  const persistBookingFlowFlag = async (value: boolean) => {
    try {
      await setBookingFlow(conversation_id, value)
    } catch (err) {
      console.error("[webhook/facebook] setBookingFlow failed:", err)
    }
  }

  if (bookingFlow && !statusIntent && !humanRequested && !reportIntent) {
    const missing = missingBookingFields(extracted)
    let bookingContext: string
    // Whether we are about to re-ask for missing details. If the flow re-gen
    // below refreshes the extraction and shows all details ARE present, we
    // recover by switching to the confirmation prompt instead of re-asking.
    let wasMissingBranch = false

    if (missing.length > 0) {
      escalate = false
      wasMissingBranch = true
      await persistConfirmFlag(false)
      bookingContext =
        `The customer is in a booking flow but the following required detail(s) are not confirmed from the latest message: ${missing.join(", ")}. ` +
        "If the customer already provided any of these details earlier in the conversation, treat them as collected and include them in your structured customer extraction. " +
        "Politely ask the customer to provide only the truly missing details. Do NOT send the final booking confirmation and do NOT escalate until all details are collected."
    } else if (confirmRequested(messageBody) && awaiting_confirmation) {
      // Escalate only when a confirmation prompt was actually shown on a
      // previous turn (awaiting_confirmation was persisted then). A premature
      // "yes" — details just became complete but no prompt was shown yet — falls
      // through to the confirmation branch below, so a customer can never be
      // escalated to Sales without first seeing their details summarized.
      escalate = true
      escalateBooking = true
      await persistConfirmFlag(false)
      await persistBookingFlowFlag(false)
      bookingContext =
        "The customer has confirmed their complete booking details. The booking is ready to be handed over to Sales."
    } else if (awaiting_confirmation && !signal) {
      // The confirmation flag was set but this message is neither a
      // confirmation nor a booking detail — the customer wandered off. Clear
      // the flow flags and let the AI answer normally.
      escalate = false
      await persistConfirmFlag(false)
      await persistBookingFlowFlag(false)
      bookingContext =
        "The customer was asked to confirm their booking details but the last message is not a confirmation and carries no booking details. " +
        "Answer the customer normally; you may briefly re-offer to continue their booking if it is natural to do so, but do not send the final booking confirmation and do not escalate."
    } else {
      // All required details are collected but not yet confirmed. Summarize the
      // details and ask the customer to confirm — this runs even when the
      // current message carries no booking signal (e.g. it completed the set
      // with just a vehicle type), and also swallows a premature "yes" so the
      // prompt is always shown before the booking can escalate. Persist the
      // confirmation flag so the next "Yes" escalates.
      escalate = false
      await persistConfirmFlag(true)
      bookingContext = CONFIRM_BOOKING_CONTEXT
    }

    // Re-generate the reply with the booking-flow context (and get a more
    // reliable customer extraction). The escalation path ignores `reply`, so
    // this is safe for the confirmed case too.
    try {
      const flowResult = await generateChatbotReply({
        message: messageBody,
        history,
        settings,
        system_prompt,
        knowledge,
        vehicleContext,
        bookingContext,
      })
      if (flowResult.reply?.trim()) reply = flowResult.reply.trim()
      if (hasExtractedDetails(flowResult.customer)) extracted = flowResult.customer
    } catch (err) {
      console.error("[webhook/facebook] booking-flow reply failed:", err)
    }

    // Recovery: the re-gen's refreshed extraction (which sees the full history)
    // can show all details are actually collected even though the first pass
    // looked incomplete. Instead of sending a redundant re-ask for details the
    // customer already gave, switch to the confirmation prompt. Costs one extra
    // Gemini call only in this rare case.
    if (wasMissingBranch && isCompleteBooking(extracted)) {
      await persistConfirmFlag(true)
      try {
        const confirmResult = await generateChatbotReply({
          message: messageBody,
          history,
          settings,
          system_prompt,
          knowledge,
          vehicleContext,
          bookingContext: CONFIRM_BOOKING_CONTEXT,
        })
        if (confirmResult.reply?.trim()) reply = confirmResult.reply.trim()
        if (hasExtractedDetails(confirmResult.customer)) extracted = confirmResult.customer
      } catch (err) {
        console.error("[webhook/facebook] booking recovery reply failed:", err)
      }
    }
  }

  // If the main reply calls produced no customer details but we still escalated
  // (human request, report, or generic AI escalation), run a focused second-pass
  // extraction so the inquiry's extracted_* fields are filled.
  if (escalate && !hasExtractedDetails(extracted) && !bookingFlow) {
    try {
      const fallback = await extractCustomerDetails({
        message: messageBody,
        history,
        settings,
        system_prompt,
        knowledge,
      })
      if (hasExtractedDetails(fallback)) extracted = fallback
    } catch (err) {
      console.error("[webhook/facebook] extraction fallback failed:", err)
    }
  }

  if (escalate) {
    await setConversationStatus(conversation_id, "pending")

    // Inquiry record (only on escalation) so Inquiry Management keeps working.
    // Any customer details the AI identified are stored in extracted_* columns.
    //
    // Escalation type priority:
    //   1. Customer explicitly asked for a human          → Human Response
    //   2. Customer reported a concern/complaint          → Report
    //   3. Booking confirmed (booking flow + complete)    → Booking
    //   4. Anything else                                  → Human Response
    let inquiry_type: "Booking" | "Human Response" | "Report"
    if (humanRequested) {
      inquiry_type = "Human Response"
    } else if (reportIntent) {
      inquiry_type = "Report"
    } else if (
      bookingFlow &&
      (escalateBooking || aiReason === "booking_confirmed" || isCompleteBooking(extracted))
    ) {
      inquiry_type = "Booking"
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
      await setBookingFlow(conversation_id, false)
    } catch (err) {
      console.error("[webhook/facebook] flow reset failed:", err)
    }
    await persistConfirmFlag(false)
    return
  }

  // Not escalated → send the AI reply. Attach the standard quick-reply menu
  // unless this inbound was itself a quick-reply tap (answer it plainly; the
  // menu returns on the next free-text message). The booking confirmation is
  // requested in plain text (no confirm buttons), so the standard menu is
  // always what the customer sees during the booking flow.
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
