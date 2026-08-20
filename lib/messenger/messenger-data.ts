import { createAdminClient } from "@/lib/supabase/admin"

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
  conflict_pending: boolean
}> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from("messenger_conversation")
    .select(
      "conversation_id, status, is_vehicle_inquiry, is_booking_flow, awaiting_confirmation, active_booking_offered, conflict_pending"
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
      conflict_pending: Boolean(existing.conflict_pending),
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

  return { conversation_id: data.conversation_id, status: "open", is_vehicle_inquiry: false, is_booking_flow: false, awaiting_confirmation: false, active_booking_offered: false, conflict_pending: false }
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

/** Builds the last N messages of a conversation as chatbot history (oldest → newest). */
export async function getConversationHistory(conversation_id: number, limit = 12) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("messenger_message")
    .select("sender_type, message_body, sent_at")
    .eq("conversation_id", conversation_id)
    .order("sent_at", { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((m: any) => ({
    role: m.sender_type === "customer" ? ("user" as const) : ("model" as const),
    text: m.message_body ?? "",
  }))
}
