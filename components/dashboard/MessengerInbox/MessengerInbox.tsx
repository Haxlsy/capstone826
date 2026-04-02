"use client"

import { useState } from "react"
import ConversationList from "./ConversationList"
import ChatPanel from "./ChatPanel"

export type ConversationStatus = "Awaiting Reply" | "Vehicle Inquiry" | "Replied"

export type FilterTab = "All" | "Awaiting Reply" | "Vehicle Inquiry" | "Replied"

export interface Message {
  id: number
  sender: "bot" | "customer" | "sales"
  text: string
  time: string
  quickReplies?: string[]
  isEscalation?: boolean
}

export interface JobReference {
  plateNo: string
  status: string
  serviceType: string
  stageProgress: string
  expectedCompletion: string
}

export interface Conversation {
  id: number
  name: string
  initials: string
  preview: string
  time: string
  status: ConversationStatus
  unread: boolean
  via: string
  jobRef?: JobReference
  messages: Message[]
}

export const conversations: Conversation[] = [
  {
    id: 1,
    name: "Juan Dela Cruz",
    initials: "JD",
    preview: "Hi, I'd like to know when my car will be ready...",
    time: "2m ago",
    status: "Vehicle Inquiry",
    unread: false,
    via: "Via Facebook Messenger",
    jobRef: {
      plateNo: "ABC 1234",
      status: "Ongoing",
      serviceType: "Full Detail",
      stageProgress: "3 of 5 stages",
      expectedCompletion: "Apr 2, 2026",
    },
    messages: [
      {
        id: 1,
        sender: "bot",
        text: "Hi! Welcome to 826 Auto Care. How can I help you today?",
        time: "10:00 AM",
        quickReplies: ["Book a Service", "Check Vehicle Status", "Talk to Sales"],
      },
      {
        id: 2,
        sender: "customer",
        text: "Check Vehicle Status",
        time: "10:01 AM",
      },
      {
        id: 3,
        sender: "bot",
        text: "Sure! Let me connect you with our Sales team for a vehicle status update.",
        time: "10:01 AM",
      },
      {
        id: 4,
        sender: "customer",
        text: "Hi, I'd like to know when my car will be ready. It's a white Toyota Fortuner, plate ABC-1234. I dropped it off last week for full detailing.",
        time: "10:02 AM",
        isEscalation: true,
      },
    ],
  },
  {
    id: 2,
    name: "Maria Garcia",
    initials: "MG",
    preview: "Can I reschedule my appointment...",
    time: "15m ago",
    status: "Awaiting Reply",
    unread: true,
    via: "Via Facebook Messenger",
    messages: [
      {
        id: 1,
        sender: "bot",
        text: "Hi! Welcome to 826 Auto Care. How can I help you today?",
        time: "9:45 AM",
        quickReplies: ["Book a Service", "Check Vehicle Status", "Talk to Sales"],
      },
      {
        id: 2,
        sender: "customer",
        text: "Can I reschedule my appointment to next week?",
        time: "9:46 AM",
        isEscalation: true,
      },
    ],
  },
  {
    id: 3,
    name: "Carlos Rivera",
    initials: "CR",
    preview: "Thank you for the update! I'll pick it u...",
    time: "1h ago",
    status: "Replied",
    unread: false,
    via: "Via Facebook Messenger",
    messages: [
      {
        id: 1,
        sender: "bot",
        text: "Hi! Welcome to 826 Auto Care. How can I help you today?",
        time: "9:00 AM",
        quickReplies: ["Book a Service", "Check Vehicle Status", "Talk to Sales"],
      },
      {
        id: 2,
        sender: "customer",
        text: "Is my car ready for pickup?",
        time: "9:01 AM",
        isEscalation: true,
      },
      {
        id: 3,
        sender: "sales",
        text: "Hi Carlos! Your vehicle is ready for pickup. Please come by the shop at your convenience.",
        time: "9:10 AM",
      },
      {
        id: 4,
        sender: "customer",
        text: "Thank you for the update! I'll pick it up tomorrow.",
        time: "9:11 AM",
      },
    ],
  },
  {
    id: 4,
    name: "Ana Reyes",
    initials: "AR",
    preview: "Is there any update on my car's A...",
    time: "2h ago",
    status: "Awaiting Reply",
    unread: true,
    via: "Via Facebook Messenger",
    messages: [
      {
        id: 1,
        sender: "bot",
        text: "Hi! Welcome to 826 Auto Care. How can I help you today?",
        time: "8:30 AM",
        quickReplies: ["Book a Service", "Check Vehicle Status", "Talk to Sales"],
      },
      {
        id: 2,
        sender: "customer",
        text: "Is there any update on my car's AC repair?",
        time: "8:31 AM",
        isEscalation: true,
      },
    ],
  },
  {
    id: 5,
    name: "Lisa Tan",
    initials: "LT",
    preview: "I'll come by tomorrow to drop off my...",
    time: "3h ago",
    status: "Replied",
    unread: false,
    via: "Via Facebook Messenger",
    messages: [
      {
        id: 1,
        sender: "bot",
        text: "Hi! Welcome to 826 Auto Care. How can I help you today?",
        time: "7:50 AM",
        quickReplies: ["Book a Service", "Check Vehicle Status", "Talk to Sales"],
      },
      {
        id: 2,
        sender: "customer",
        text: "I want to book a full detail service.",
        time: "7:51 AM",
        isEscalation: true,
      },
      {
        id: 3,
        sender: "sales",
        text: "Hi Lisa! We'd be happy to book you in. Can you share your preferred date and vehicle details?",
        time: "7:55 AM",
      },
      {
        id: 4,
        sender: "customer",
        text: "I'll come by tomorrow to drop off my car.",
        time: "7:56 AM",
      },
    ],
  },
  {
    id: 6,
    name: "Pedro Santos",
    initials: "PS",
    preview: "How much is the ceramic coating pac...",
    time: "4h ago",
    status: "Awaiting Reply",
    unread: true,
    via: "Via Facebook Messenger",
    messages: [
      {
        id: 1,
        sender: "bot",
        text: "Hi! Welcome to 826 Auto Care. How can I help you today?",
        time: "6:45 AM",
        quickReplies: ["Book a Service", "Check Vehicle Status", "Talk to Sales"],
      },
      {
        id: 2,
        sender: "customer",
        text: "How much is the ceramic coating package?",
        time: "6:46 AM",
        isEscalation: true,
      },
    ],
  },
  {
    id: 7,
    name: "Elena Flores",
    initials: "EF",
    preview: "What's included in the PPF package?",
    time: "5h ago",
    status: "Replied",
    unread: false,
    via: "Via Facebook Messenger",
    messages: [
      {
        id: 1,
        sender: "bot",
        text: "Hi! Welcome to 826 Auto Care. How can I help you today?",
        time: "5:30 AM",
        quickReplies: ["Book a Service", "Check Vehicle Status", "Talk to Sales"],
      },
      {
        id: 2,
        sender: "customer",
        text: "What's included in the PPF package?",
        time: "5:31 AM",
        isEscalation: true,
      },
      {
        id: 3,
        sender: "sales",
        text: "Hi Elena! Our PPF package includes full hood, front bumper, fenders, mirrors, and door edges. Would you like the full wrap option as well?",
        time: "5:40 AM",
      },
    ],
  },
  {
    id: 8,
    name: "Roberto Lim",
    initials: "RL",
    preview: "Can I get a quote for window tinting?",
    time: "1d ago",
    status: "Replied",
    unread: false,
    via: "Via Facebook Messenger",
    messages: [
      {
        id: 1,
        sender: "bot",
        text: "Hi! Welcome to 826 Auto Care. How can I help you today?",
        time: "Yesterday 3:00 PM",
        quickReplies: ["Book a Service", "Check Vehicle Status", "Talk to Sales"],
      },
      {
        id: 2,
        sender: "customer",
        text: "Can I get a quote for window tinting?",
        time: "Yesterday 3:01 PM",
        isEscalation: true,
      },
      {
        id: 3,
        sender: "sales",
        text: "Hi Roberto! Window tinting starts at ₱3,500 for sedans and ₱4,500 for SUVs. Would you like to schedule a visit?",
        time: "Yesterday 3:10 PM",
      },
    ],
  },
]

export default function MessengerInbox() {
  const [activeId, setActiveId] = useState<number>(1)
  const [filter, setFilter] = useState<FilterTab>("All")
  const [search, setSearch] = useState("")
  const [convos, setConvos] = useState<Conversation[]>(conversations)

  const filtered = convos.filter((c) => {
    const matchesFilter = filter === "All" || c.status === filter
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.preview.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const activeConvo = convos.find((c) => c.id === activeId) ?? convos[0]

  function handleSend(text: string) {
    if (!text.trim()) return
    const newMsg: Message = {
      id: Date.now(),
      sender: "sales",
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
    setConvos((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, status: "Replied", preview: text.trim(), messages: [...c.messages, newMsg] }
          : c
      )
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList
        conversations={filtered}
        activeId={activeId}
        filter={filter}
        search={search}
        onSelect={(id) => setActiveId(id)}
        onFilterChange={setFilter}
        onSearchChange={setSearch}
      />
      <ChatPanel conversation={activeConvo} onSend={handleSend} />
    </div>
  )
}
