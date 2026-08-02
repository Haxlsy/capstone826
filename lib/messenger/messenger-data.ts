import { createAdminClient } from "@/lib/supabase/admin"

const CONVERSATION_SELECT = `conversation_id,
  handled_by_user_id,
  handler_role,
  psid,
  customer_name,
  status,
  is_vehicle_inquiry,
  last_message_at,
  created_at,
  handled_by:handled_by_user_id(user_id, full_name),
  messenger_message(message_id, sender_type, message_body, sent_at)`

/**
 * Lists conversations. By default only escalated ones (pending/closed) are
 * returned so the Sales view never shows AI-handled chats. Pass `status`
 * to narrow to a single status (e.g. "pending").
 */
export async function getConversations({ status }: { status?: string } = {}) {
  const supabase = createAdminClient()

  let query = supabase
    .from("messenger_conversation")
    .select(CONVERSATION_SELECT)

  if (status) {
    query = query.eq("status", status)
  } else {
    query = query.in("status", ["pending", "closed"])
  }

  const { data, error } = await query
    .order("sent_at", { referencedTable: "messenger_message", ascending: false })
    .limit(1, { referencedTable: "messenger_message" })
    .order("last_message_at", { ascending: false })

  if (error) throw new Error(error.message)

  const conversations = (data ?? []).map((c: any) => ({
    ...c,
    latest_message: c.messenger_message?.[0] ?? null,
    messenger_message: undefined,
  }))

  return { conversations }
}

export async function getConversationMessages(conversationId: number) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("messenger_message")
    .select(
      `message_id,
       conversation_id,
       sent_by_user_id,
       sender_type,
       message_body,
       sent_at,
       fb_message_id,
       sent_by:sent_by_user_id(user_id, full_name)`
    )
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })

  if (error) throw new Error(error.message)

  return { messages: data ?? [] }
}

export type ConversationStatus = "open" | "pending" | "closed"

export async function getOrCreateConversationByPsid(
  psid: string,
  customerName: string
): Promise<{ conversation_id: number; status: ConversationStatus }> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from("messenger_conversation")
    .select("conversation_id, status")
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
    }
  }

  const { data, error } = await supabase
    .from("messenger_conversation")
    .insert({
      customer_name: customerName,
      psid,
      status: "open",
      is_vehicle_inquiry: false,
      last_message_at: now,
    })
    .select("conversation_id")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create conversation")
  }

  return { conversation_id: data.conversation_id, status: "open" }
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
