"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  MessageSquareText,
  Search,
  Inbox,
  Clock,
} from "lucide-react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import {
  useMessengerConversations,
  type MessengerConversation,
} from "@/hooks/use-messenger-conversations"
import { useMessengerMessages } from "@/hooks/use-messenger-messages"

type StatusFilter = "pending" | "closed" | "all"

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "closed",  label: "Closed" },
  { key: "all",     label: "All" },
]

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-red-100 text-red-600 border-red-200",
  closed:  "bg-gray-100 text-gray-500 border-gray-200",
  open:    "bg-blue-100 text-blue-600 border-blue-200",
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

export default function MessengerChat({
  initialConversations,
}: {
  initialConversations: MessengerConversation[]
}) {
  const queryClient = useQueryClient()
  const { data: conversations = [], refetch } = useMessengerConversations(initialConversations)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending")
  const [searchQuery, setSearchQuery] = useState("")

  const messagesQuery = useMessengerMessages(selectedId)
  const scrollRef = useRef<HTMLDivElement>(null)

  useRealtimeRefetch(["messenger_conversation", "messenger_message"], () => {
    refetch()
    if (selectedId != null) {
      queryClient.invalidateQueries({ queryKey: ["messenger-messages", selectedId] })
    }
  })

  useEffect(() => {
    if (selectedId == null && conversations.length > 0) {
      setSelectedId(conversations[0].conversation_id)
    }
  }, [conversations, selectedId])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messagesQuery.data])

  const filtered = conversations.filter((c) => {
    const matchFilter = statusFilter === "all" || c.status === statusFilter
    const q = searchQuery.toLowerCase()
    const matchSearch =
      q === "" ||
      (c.customer_name ?? "").toLowerCase().includes(q) ||
      (c.latest_message?.message_body ?? "").toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const selected = conversations.find((c) => c.conversation_id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Messenger Chats</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Escalated Facebook conversations waiting for your attention.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-full border border-gray-200 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                statusFilter === f.key
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        {/* Conversation list */}
        <div className="w-80 shrink-0 bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Inbox className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-400">No escalated conversations.</p>
              </div>
            ) : (
              filtered.map((c) => {
                const active = c.conversation_id === selectedId
                return (
                  <button
                    key={c.conversation_id}
                    onClick={() => setSelectedId(c.conversation_id)}
                    className={`w-full text-left px-4 py-3 flex gap-3 border-b border-gray-50 transition-colors ${
                      active ? "bg-blue-50/60" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {initials(c.customer_name ?? "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {c.customer_name ?? "Messenger User"}
                        </p>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">
                          {timeAgo(c.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-gray-500 truncate">
                          {c.latest_message?.message_body ?? "No messages yet"}
                        </p>
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
                            STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-500 border-gray-200"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col min-w-0">
          {selected ? (
            <>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">
                    {initials(selected.customer_name ?? "?")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {selected.customer_name ?? "Messenger User"}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Started {timeAgo(selected.created_at)}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border capitalize ${
                    STATUS_STYLES[selected.status] ?? "bg-gray-100 text-gray-500 border-gray-200"
                  }`}
                >
                  {selected.status}
                </span>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messagesQuery.isPending ? (
                  <p className="text-sm text-gray-400 text-center py-10">Loading messages…</p>
                ) : messagesQuery.error ? (
                  <p className="text-sm text-red-500 text-center py-10">
                    {messagesQuery.error.message}
                  </p>
                ) : (messagesQuery.data ?? []).length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <MessageSquareText className="w-8 h-8 text-gray-300" />
                    <p className="text-sm text-gray-400">No messages in this conversation yet.</p>
                  </div>
                ) : (
                  (messagesQuery.data ?? []).map((m) => {
                    const isCustomer = m.sender_type === "customer"
                    return (
                      <div
                        key={m.message_id}
                        className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm ${
                            isCustomer
                              ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                              : "bg-blue-600 text-white rounded-tr-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.message_body}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              isCustomer ? "text-gray-400" : "text-blue-200"
                            }`}
                          >
                            {fmtTime(m.sent_at)}
                            {!isCustomer && " · 826"}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="px-5 py-3 border-t border-gray-100 shrink-0">
                <p className="text-xs text-gray-400 text-center">
                  View-only. The AI chatbot auto-replies to customers; escalated chats are for
                  your attention.
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
              <MessageSquareText className="w-10 h-10 text-gray-300" />
              <p className="text-sm text-gray-400">Select a conversation to view the chat.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
