"use client"

import { useQuery } from "@tanstack/react-query"

export type MessengerMessage = {
  message_id: number
  conversation_id: number
  sender_type: string
  message_body: string | null
  sent_at: string
  fb_message_id: string | null
  sent_by: { user_id: string; full_name: string } | null
}

export function useMessengerMessages(conversationId: number | null) {
  return useQuery<MessengerMessage[]>({
    queryKey: ["messenger-messages", conversationId],
    enabled: conversationId != null,
    queryFn: async () => {
      const res = await fetch(`/api/sales/messenger/conversations/${conversationId}/messages`)
      if (!res.ok) throw new Error("Failed to fetch messages")
      const json = await res.json()
      return json.messages ?? []
    },
  })
}
