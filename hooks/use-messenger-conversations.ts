"use client"

import { useQuery } from "@tanstack/react-query"

export type MessengerConversation = {
  conversation_id: number
  psid: string | null
  customer_name: string | null
  status: "open" | "pending" | "closed"
  handler_role: "sales" | "admin" | null
  handled_by_user_id: string | null
  is_vehicle_inquiry: boolean
  last_message_at: string | null
  created_at: string
  handled_by: { user_id: string; full_name: string } | null
  latest_message: {
    message_id: number
    sender_type: string
    message_body: string | null
    sent_at: string
  } | null
}

export function useMessengerConversations(initialData?: MessengerConversation[]) {
  return useQuery<MessengerConversation[]>({
    queryKey: ["messenger-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/sales/messenger/conversations")
      if (!res.ok) throw new Error("Failed to fetch conversations")
      const json = await res.json()
      return json.conversations ?? []
    },
    initialData,
  })
}
