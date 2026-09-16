import { createAdminClient } from "@/lib/supabase/admin"
import { toHistoryMessages } from "@/lib/messenger/chatbot"
import type { CustomerDetails } from "@/types/chatbot"

export type ConversationStatus = "open" | "pending" | "closed"

export async function getOrCreateConversationByPsid(
  psid: string,
  customerName: string
): Promise<{
  conversation_id: number
  status: ConversationStatus
  is_vehicle_inquiry: boolean
  is_booking_flow: boolean
  awaiting_confirmation: boolean
  active_booking_offered: boolean
  booking_duplicate_notified: boolean
  conflict_pending: boolean
  awaiting_link_verification: boolean
  link_attempts: number
  link_conflict_pending: boolean
  offtopic_streak: number
  policy_streak: number
  complaint_streak: number
  booking_draft: CustomerDetails
  /** Pre-update value — the timestamp of the customer's PREVIOUS message, not
   *  this one (this call already writes `now` as the new `last_message_at`
   *  below). Used by the webhook's quick-reply cooldown to measure how long
   *  ago the previous message arrived. */
  last_message_at: string | null
  /** Pre-update value — the quick-reply payload (if any) from the customer's
   *  previous message. See setLastQuickReplyPayload. */
  last_quick_reply_payload: string | null
}> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from("messenger_conversation")
    .select(
      "conversation_id, status, is_vehicle_inquiry, is_booking_flow, awaiting_confirmation, active_booking_offered, booking_duplicate_notified, conflict_pending, awaiting_link_verification, link_attempts, link_conflict_pending, offtopic_streak, policy_streak, complaint_streak, draft_name, draft_contact, draft_plate, draft_vehicle, draft_email, last_message_at, last_quick_reply_payload"
    )
    .eq("psid", psid)
    .maybeSingle()

  const now = new Date().toISOString()

  if (existing) {
    await supabase
      .from("messenger_conversation")
      .update({ customer_name: customerName, last_message_at: now })
      .eq("conversation_id", existing.conversation_id)

    return {
      conversation_id: existing.conversation_id,
      status: existing.status as ConversationStatus,
      is_vehicle_inquiry: Boolean(existing.is_vehicle_inquiry),
      is_booking_flow: Boolean(existing.is_booking_flow),
      awaiting_confirmation: Boolean(existing.awaiting_confirmation),
      active_booking_offered: Boolean(existing.active_booking_offered),
      booking_duplicate_notified: Boolean(existing.booking_duplicate_notified),
      conflict_pending: Boolean(existing.conflict_pending),
      awaiting_link_verification: Boolean(existing.awaiting_link_verification),
      link_attempts: Number(existing.link_attempts ?? 0),
      link_conflict_pending: Boolean(existing.link_conflict_pending),
      offtopic_streak: Number(existing.offtopic_streak ?? 0),
      policy_streak: Number(existing.policy_streak ?? 0),
      complaint_streak: Number(existing.complaint_streak ?? 0),
      booking_draft: {
        full_name:      existing.draft_name    ?? null,
        contact_number: existing.draft_contact ?? null,
        plate_number:   existing.draft_plate   ?? null,
        vehicle_unit:   existing.draft_vehicle ?? null,
        email:          existing.draft_email   ?? null,
      },
      last_message_at: existing.last_message_at ?? null,
      last_quick_reply_payload: existing.last_quick_reply_payload ?? null,
    }
  }

  const { data, error } = await supabase
    .from("messenger_conversation")
    .insert({
      customer_name: customerName,
      psid,
      status: "open",
      is_vehicle_inquiry: false,
      is_booking_flow: false,
      last_message_at: now,
    })
    .select("conversation_id")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create conversation")
  }

  return { conversation_id: data.conversation_id, status: "open", is_vehicle_inquiry: false, is_booking_flow: false, awaiting_confirmation: false, active_booking_offered: false, booking_duplicate_notified: false, conflict_pending: false, awaiting_link_verification: false, link_attempts: 0, link_conflict_pending: false, offtopic_streak: 0, policy_streak: 0, complaint_streak: 0, booking_draft: { full_name: null, contact_number: null, plate_number: null, vehicle_unit: null, email: null }, last_message_at: null, last_quick_reply_payload: null }
}

/** Marks the payload of the most recent predefined quick-reply button the
 *  customer tapped — read back (pre-update) by the next call to
 *  getOrCreateConversationByPsid so the webhook can detect a rapid repeat tap
 *  of the same button. Pass `null` for a typed (non-quick-reply) message so a
 *  later quick reply doesn't get compared against a stale earlier tap. */
export async function setLastQuickReplyPayload(conversation_id: number, payload: string | null) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("messenger_conversation")
    .update({ last_quick_reply_payload: payload })
    .eq("conversation_id", conversation_id)

  if (error) throw new Error(error.message)
}

/** True when a message with this exact Facebook message ID was already
 *  recorded for this conversation — Meta can redeliver the same webhook
 *  event, and this catches that before it triggers a second reply. */
export async function messageAlreadyProcessed(conversation_id: number, fb_message_id: string | null) {
  if (!fb_message_id) return false
  const supabase = createAdminClient()

  const { data } = await supabase
    .from("messenger_message")
    .select("message_id")
    .eq("conversation_id", conversation_id)
    .eq("fb_message_id", fb_message_id)
    .limit(1)
    .maybeSingle()

  return Boolean(data)
}

/**
 * Persists the current booking-flow draft (the details collected so far in this
 * booking attempt). Pass `null` to clear it — done on every terminal path
 * (escalation, wander-off, duplicate-ack, vehicle-in-service, flow reset).
 */
export async function setBookingDraft(
  conversation_id: number,
  d: CustomerDetails | null | undefined
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("messenger_conversation")
    .update({
      draft_name:    d?.full_name      ?? null,
      draft_contact: d?.contact_number ?? null,
      draft_plate:   d?.plate_number   ?? null,
      draft_vehicle: d?.vehicle_unit   ?? null,
      draft_email:   d?.email          ?? null,
    })
    .eq("conversation_id", conversation_id)

  if (error) throw new Error(error.message)
}

/**
 * Sets the consecutive off-topic / policy-violation / complaint streak
 * counters for a conversation. `complaint` is independent of the other two —
 * it isn't part of the off-topic/policy graduated ladder (a "complaint" is a
 * real concern, given only one grace reply, not four) — see
 * app/api/webhook/facebook/route.ts.
 */
export async function setViolationStreaks(
  conversation_id: number,
  offtopic: number,
  policy: number,
  complaint: number
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("messenger_conversation")
    .update({ offtopic_streak: offtopic, policy_streak: policy, complaint_streak: complaint })
    .eq("conversation_id", conversation_id)

  if (error) throw new Error(error.message)
}

/** Marks whether the next customer message is a plate/phone account-linking attempt. */
export async function setAwaitingLinkVerification(conversation_id: number, value: boolean) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("messenger_conversation")
    .update({ awaiting_link_verification: value })
    .eq("conversation_id", conversation_id)

  if (error) throw new Error(error.message)
}

/** Sets the failed account-linking attempt counter for a conversation. */
export async function setLinkAttempts(conversation_id: number, value: number) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("messenger_conversation")
    .update({ link_attempts: value })
    .eq("conversation_id", conversation_id)

  if (error) throw new Error(error.message)
}

/**
 * Marks that the customer has already been given the neutral "couldn't verify
 * those details" warning for a plate owned by ANOTHER Messenger account. The
 * next such claim escalates to Sales as a possible impersonation.
 */
export async function setLinkConflictPending(conversation_id: number, value: boolean) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("messenger_conversation")
    .update({ link_conflict_pending: value })
    .eq("conversation_id", conversation_id)

  if (error) throw new Error(error.message)
}

/** Marks whether the AI has asked the customer to clarify an identity conflict on their booking. */
export async function setConflictPending(conversation_id: number, value: boolean) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("messenger_conversation")
    .update({ conflict_pending: value })
    .eq("conversation_id", conversation_id)

  if (error) throw new Error(error.message)
}

/** Marks whether the AI has informed the customer that they already have an active booking. */
export async function setActiveBookingOffered(conversation_id: number, value: boolean) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("messenger_conversation")
    .update({ active_booking_offered: value })
    .eq("conversation_id", conversation_id)

  if (error) throw new Error(error.message)
}

/** Marks whether the AI has told the customer their booking is already on file (dedup). */
export async function setBookingDuplicateNotified(conversation_id: number, value: boolean) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("messenger_conversation")
    .update({ booking_duplicate_notified: value })
    .eq("conversation_id", conversation_id)

  if (error) throw new Error(error.message)
}

/** Marks whether the AI has asked the customer to confirm their booking details. */
export async function setAwaitingConfirmation(conversation_id: number, value: boolean) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("messenger_conversation")
    .update({ awaiting_confirmation: value })
    .eq("conversation_id", conversation_id)

  if (error) throw new Error(error.message)
}

/** Marks whether the conversation is currently a vehicle-status flow. */
export async function setVehicleInquiry(conversation_id: number, value: boolean) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("messenger_conversation")
    .update({ is_vehicle_inquiry: value })
    .eq("conversation_id", conversation_id)
    .select("conversation_id")
    .single()

  if (error) throw new Error(error.message)
  return data
}

/** Marks whether the conversation is currently in a booking flow. */
export async function setBookingFlow(conversation_id: number, value: boolean) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("messenger_conversation")
    .update({ is_booking_flow: value })
    .eq("conversation_id", conversation_id)
    .select("conversation_id")
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function insertMessage(input: {
  conversation_id: number
  sender_type: string
  message_body: string
  sent_at?: string
  sent_by_user_id?: string | null
  fb_message_id?: string | null
}) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("messenger_message")
    .insert({
      conversation_id: input.conversation_id,
      sender_type:     input.sender_type,
      message_body:    input.message_body,
      sent_at:         input.sent_at ?? new Date().toISOString(),
      sent_by_user_id: input.sent_by_user_id ?? null,
      fb_message_id:   input.fb_message_id ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function setConversationStatus(
  conversation_id: number,
  status: ConversationStatus
) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("messenger_conversation")
    .update({ status })
    .eq("conversation_id", conversation_id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Builds the MOST RECENT N messages of a conversation as chatbot history
 * (oldest → newest). The query orders newest-first so `limit` keeps the latest
 * turns; `toHistoryMessages` reverses back to chronological order for the model.
 */
export async function getConversationHistory(conversation_id: number, limit = 20) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("messenger_message")
    .select("sender_type, message_body, sent_at")
    .eq("conversation_id", conversation_id)
    .order("sent_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return toHistoryMessages(data ?? [])
}
