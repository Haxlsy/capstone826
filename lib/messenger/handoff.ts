import { createAdminClient } from "@/lib/supabase/admin"
import { insertMessage } from "@/lib/messenger/messenger-data"
import { sendMessengerQuickReply, type MessengerQuickReply } from "@/lib/messenger/graph"

/**
 * The standard quick-reply menu. Attached to every non-escalated bot reply
 * (see app/api/webhook/facebook/route.ts) and re-sent once when a human
 * handoff concludes.
 */
export const QUICK_REPLIES: MessengerQuickReply[] = [
  { content_type: "text", title: "Services & Prices", payload: "services" },
  { content_type: "text", title: "Booking",           payload: "booking"  },
  { content_type: "text", title: "Report a Concern",  payload: "report"   },
  { content_type: "text", title: "Vehicle Status",    payload: "status"   },
]

/** Sent with the menu when Sales concludes a handoff and the bot resumes. */
export const RESUME_MENU_MESSAGE =
  "Our team has finished helping with your request. I'm back and ready to assist — " +
  "here's what I can help you with:"

/**
 * Meta's standard messaging window: a Page may only send within 24 hours of
 * the customer's last message. Past that the Graph call is rejected, so the
 * resume menu is skipped and the customer gets it on their next message.
 */
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Decides whether a concluded handoff should hand the conversation back to the
 * bot, and whether the resume menu can still be pushed. Pure — the IO lives in
 * `resumeBotAfterHandoff`.
 */
export function shouldResumeBot(input: {
  conversationStatus: string | null
  /** Inquiries for this psid still sitting at status 'open'. */
  openInquiryCount: number
  lastCustomerMessageAt: string | null
  now?: Date
}): { resume: boolean; canPush: boolean; reason: string } {
  const { conversationStatus, openInquiryCount, lastCustomerMessageAt } = input

  // Only a human-owned thread can be handed back. Anything else means the bot
  // already owns it (or a previous resume already ran) — never push twice.
  if (conversationStatus !== "pending") {
    return { resume: false, canPush: false, reason: `conversation is '${conversationStatus ?? "missing"}', not 'pending'` }
  }

  // Another inquiry for the same customer is still open — a human still owns
  // this thread even though one of their inquiries was just concluded.
  if (openInquiryCount > 0) {
    return { resume: false, canPush: false, reason: `${openInquiryCount} other open inquiry(ies) for this customer` }
  }

  const lastAt = lastCustomerMessageAt ? Date.parse(lastCustomerMessageAt) : NaN
  const now = (input.now ?? new Date()).getTime()
  const inWindow = Number.isFinite(lastAt) && now - lastAt < MESSAGING_WINDOW_MS

  return {
    resume: true,
    canPush: inWindow,
    reason: inWindow
      ? "handoff concluded — resuming bot and re-sending the menu"
      : "handoff concluded — outside the 24h messaging window, menu returns on the customer's next message",
  }
}

/**
 * Concludes a human handoff: hands the conversation back to the bot and
 * re-sends the quick-reply menu so the customer does not have to start the
 * chat again. Best-effort — never throws, so a Messenger outage can never fail
 * the Sales action that called it.
 */
export async function resumeBotAfterHandoff(psid: string): Promise<void> {
  if (!psid) return

  try {
    const admin = createAdminClient()

    const { data: conv } = await admin
      .from("messenger_conversation")
      .select("conversation_id, status")
      .eq("psid", psid)
      .maybeSingle()

    if (!conv) return

    const { count: openInquiryCount } = await admin
      .from("inquiry")
      .select("id", { count: "exact", head: true })
      .eq("psid", psid)
      .eq("status", "open")

    // The customer's own last message — NOT messenger_conversation.last_message_at,
    // which staff status changes also stamp, so it is not a reliable window signal.
    const { data: lastCustomerMsg } = await admin
      .from("messenger_message")
      .select("sent_at")
      .eq("conversation_id", conv.conversation_id)
      .eq("sender_type", "customer")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const decision = shouldResumeBot({
      conversationStatus: conv.status,
      openInquiryCount: openInquiryCount ?? 0,
      lastCustomerMessageAt: lastCustomerMsg?.sent_at ?? null,
    })

    if (!decision.resume) {
      console.log(`[messenger/handoff] psid=${psid} not resumed: ${decision.reason}`)
      return
    }

    // Hand the thread back to the bot with every in-flight AI flow flag cleared,
    // so the next customer message starts from a clean slate.
    const { error: updErr } = await admin
      .from("messenger_conversation")
      .update({
        status:                     "closed",
        is_vehicle_inquiry:         false,
        is_booking_flow:            false,
        awaiting_confirmation:      false,
        active_booking_offered:     false,
        booking_duplicate_notified: false,
        conflict_pending:           false,
        awaiting_link_verification: false,
        link_attempts:              0,
        offtopic_streak:            0,
        policy_streak:              0,
        draft_name:                 null,
        draft_contact:              null,
        draft_plate:                null,
        draft_vehicle:              null,
        draft_email:                null,
      })
      .eq("conversation_id", conv.conversation_id)

    if (updErr) {
      console.error("[messenger/handoff] conversation reset failed:", updErr.message)
      return
    }

    if (!decision.canPush) {
      console.log(`[messenger/handoff] psid=${psid}: ${decision.reason}`)
      return
    }

    const mid = await sendMessengerQuickReply(psid, RESUME_MENU_MESSAGE, QUICK_REPLIES)

    // Only record a message that actually reached the customer — a failed send
    // written to history would poison the AI context and the staff transcript.
    if (!mid) {
      console.error(`[messenger/handoff] resume menu send failed for psid=${psid}`)
      return
    }

    await insertMessage({
      conversation_id: conv.conversation_id,
      sender_type:     "agent",
      message_body:    RESUME_MENU_MESSAGE,
      sent_at:         new Date().toISOString(),
      fb_message_id:   mid,
    })
  } catch (err) {
    console.error("[messenger/handoff] resumeBotAfterHandoff failed:", err)
  }
}
