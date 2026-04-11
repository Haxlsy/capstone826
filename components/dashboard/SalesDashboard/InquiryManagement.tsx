"use client"

import { useState } from "react"
import {
  MessageCircle,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  ChevronRight,
  User,
  Car,
  Phone,
  Hash,
  CheckCheck,
  CircleDot,
} from "lucide-react"

type InquiryStatus = "ready_to_transfer" | "awaiting_human_reply" | "resolved"
type InquiryType = "Booking" | "Human Response" | "Report"

interface Inquiry {
  id: string
  psid: string
  messengerName: string
  timeElapsed: string
  escalationDate: string
  type: InquiryType
  status: InquiryStatus
  extractedName: string | null
  plateNumber: string | null
  contactNumber: string | null
  lastMessage: string | null
}

const MOCK_INQUIRIES: Inquiry[] = [
  {
    id: "1",
    psid: "PSID_7823641",
    messengerName: "Maria Santos",
    timeElapsed: "2 hours ago",
    escalationDate: "Apr 11, 2026 · 9:15 AM",
    type: "Booking",
    status: "ready_to_transfer",
    extractedName: "Maria Santos",
    plateNumber: "ABC 1234",
    contactNumber: "09171234567",
    lastMessage: "Hi, I want to check the status of my car. Plate number ABC 1234, my name is Maria Santos and you can reach me at 09171234567.",
  },
  {
    id: "2",
    psid: "PSID_4491028",
    messengerName: "Carlo Reyes",
    timeElapsed: "6 min ago",
    escalationDate: "Apr 11, 2026 · 11:09 AM",
    type: "Booking",
    status: "ready_to_transfer",
    extractedName: "Carlo Reyes",
    plateNumber: "XYZ 5678",
    contactNumber: "09281234567",
    lastMessage: "I'd like to book a full detail for my car. My plate is XYZ 5678.",
  },
  {
    id: "3",
    psid: "PSID_9921033",
    messengerName: "Unknown",
    timeElapsed: "12 min ago",
    escalationDate: "Apr 11, 2026 · 11:03 AM",
    type: "Human Response",
    status: "awaiting_human_reply",
    extractedName: null,
    plateNumber: null,
    contactNumber: null,
    lastMessage: "I have a complaint about the service last week. Can someone please assist me?",
  },
  {
    id: "4",
    psid: "PSID_3312874",
    messengerName: "Jose Dela Cruz",
    timeElapsed: "1 day ago",
    escalationDate: "Apr 10, 2026 · 2:30 PM",
    type: "Report",
    status: "resolved",
    extractedName: "Jose Dela Cruz",
    plateNumber: "DEF 9012",
    contactNumber: "09951234567",
    lastMessage: "When will my car be ready? It's been 3 days already.",
  },
]

const STATUS_LABELS: Record<InquiryStatus, string> = {
  ready_to_transfer: "Ready to Transfer",
  awaiting_human_reply: "Awaiting Human Reply",
  resolved: "Resolved",
}

const STATUS_COLORS: Record<InquiryStatus, string> = {
  ready_to_transfer: "bg-green-100 text-green-700 border-green-200",
  awaiting_human_reply: "bg-orange-100 text-orange-700 border-orange-200",
  resolved: "bg-gray-100 text-gray-500 border-gray-200",
}

const STATUS_DOT: Record<InquiryStatus, string> = {
  ready_to_transfer: "bg-green-500",
  awaiting_human_reply: "bg-orange-400",
  resolved: "bg-gray-300",
}

const TYPE_COLORS: Record<InquiryType, string> = {
  Booking: "bg-blue-50 text-blue-600 border-blue-200",
  "Human Response": "bg-purple-50 text-purple-600 border-purple-200",
  Report: "bg-yellow-50 text-yellow-600 border-yellow-200",
}

type Tab = "all" | "ready_to_transfer" | "awaiting_human_reply" | "resolved"

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready_to_transfer", label: "Ready to Transfer" },
  { key: "awaiting_human_reply", label: "Awaiting Human Reply" },
  { key: "resolved", label: "Resolved" },
]

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

export default function InquiryManagement() {
  const [inquiries, setInquiries] = useState<Inquiry[]>(MOCK_INQUIRIES)
  const [activeTab, setActiveTab] = useState<Tab>("all")
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_INQUIRIES[0].id)
  const [transferredIds, setTransferredIds] = useState<Set<string>>(new Set())

  const incomingToday = inquiries.length
  const readyToTransfer = inquiries.filter((i) => i.status === "ready_to_transfer").length
  const awaitingReply = inquiries.filter((i) => i.status === "awaiting_human_reply").length
  const transferred = inquiries.filter((i) => i.status === "resolved").length

  const filtered =
    activeTab === "all" ? inquiries : inquiries.filter((i) => i.status === activeTab)

  const selected = inquiries.find((i) => i.id === selectedId) ?? null

  function handleResolve(id: string) {
    setInquiries((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "resolved" } : i))
    )
  }

  function handleRecordDetails(id: string) {
    setTransferredIds((prev) => new Set([...prev, id]))
    setInquiries((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "resolved" } : i))
    )
  }

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Inquiry Management</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Escalated chatbot conversations requiring Sales action.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatPill
          label="Incoming Today"
          count={incomingToday}
          icon={MessageCircle}
          color="text-blue-500"
          bg="bg-blue-50"
          border="border-blue-200"
        />
        <StatPill
          label="Ready to Transfer"
          count={readyToTransfer}
          icon={ArrowRightLeft}
          color="text-green-600"
          bg="bg-green-50"
          border="border-green-200"
        />
        <StatPill
          label="Awaiting Human Reply"
          count={awaitingReply}
          icon={Clock}
          color="text-orange-500"
          bg="bg-orange-50"
          border="border-orange-200"
        />
        <StatPill
          label="Transferred"
          count={transferred}
          icon={CheckCheck}
          color="text-gray-500"
          bg="bg-gray-100"
          border="border-gray-200"
        />
      </div>

      {/* Main Panel */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left: Card List */}
        <div className="flex flex-col w-[380px] shrink-0 bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-3 pt-3 gap-1 flex-wrap">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg mb-2 transition-colors ${
                  activeTab === tab.key
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {tab.label}
                {tab.key !== "all" && (
                  <span
                    className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {tab.key === "ready_to_transfer"
                      ? readyToTransfer
                      : tab.key === "awaiting_human_reply"
                      ? awaitingReply
                      : transferred}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-10">No inquiries.</p>
            )}
            {filtered.map((inq) => (
              <button
                key={inq.id}
                onClick={() => setSelectedId(inq.id)}
                className={`w-full text-left px-4 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                  selectedId === inq.id ? "bg-blue-50/60" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    inq.extractedName
                      ? "bg-gray-200 text-gray-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {inq.extractedName ? getInitials(inq.extractedName) : "?"}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-800 truncate">
                      {inq.messengerName}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[inq.status]}`} />
                      <span className="text-[10px] text-gray-400">{inq.timeElapsed}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[inq.type]}`}
                    >
                      {inq.type}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[inq.status]}`}
                    >
                      {STATUS_LABELS[inq.status]}
                    </span>
                  </div>

                  {(inq.plateNumber || inq.contactNumber) && (
                    <div className="flex items-center gap-3 mt-2">
                      {inq.plateNumber && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Car className="w-3 h-3" /> {inq.plateNumber}
                        </span>
                      )}
                      {inq.contactNumber && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {inq.contactNumber}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Detail Panel */}
        {selected ? (
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-5 overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-700">
                  {selected.extractedName ? getInitials(selected.extractedName) : "?"}
                </div>
                <div>
                  <p className="text-base font-bold text-gray-800">{selected.messengerName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{selected.escalationDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${TYPE_COLORS[selected.type]}`}
                >
                  {selected.type}
                </span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[selected.status]}`}
                >
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Messenger Identity */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Messenger Identity
              </p>
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <Hash className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400">Page-Scoped ID (auto-captured)</p>
                  <p className="text-sm font-mono font-semibold text-gray-700">{selected.psid}</p>
                </div>
              </div>
            </div>

            {/* AI-Extracted Fields */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                AI-Extracted Fields
              </p>
              <div className="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden">
                <FieldRow
                  label="Full name"
                  value={selected.extractedName}
                  icon={<User className="w-3.5 h-3.5 text-gray-400" />}
                />
                <FieldRow
                  label="Plate number"
                  value={selected.plateNumber}
                  icon={<Car className="w-3.5 h-3.5 text-gray-400" />}
                />
                <FieldRow
                  label="Contact number"
                  value={selected.contactNumber}
                  icon={<Phone className="w-3.5 h-3.5 text-gray-400" />}
                />
              </div>
            </div>

            {/* Last Message */}
            {selected.lastMessage && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Last Message from Customer
                </p>
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {selected.lastMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-auto pt-4 flex flex-col gap-3">
              {selected.status === "ready_to_transfer" &&
                selected.type === "Booking" &&
                !transferredIds.has(selected.id) && (
                  <button
                    onClick={() => handleRecordDetails(selected.id)}
                    className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Record Customer Details
                  </button>
                )}

              {transferredIds.has(selected.id) && (
                <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Transferred to Customer Records
                </div>
              )}

              {selected.status !== "resolved" && !transferredIds.has(selected.id) && (
                <button
                  onClick={() => handleResolve(selected.id)}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <CircleDot className="w-4 h-4" />
                  Mark as Resolved
                </button>
              )}

              {selected.status === "resolved" && !transferredIds.has(selected.id) && (
                <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 text-sm font-medium">
                  <CheckCheck className="w-4 h-4" />
                  Resolved
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl flex items-center justify-center">
            <p className="text-sm text-gray-400">Select an inquiry to view details.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({
  label,
  count,
  icon: Icon,
  color,
  bg,
  border,
}: {
  label: string
  count: number
  icon: React.ElementType
  color: string
  bg: string
  border: string
}) {
  return (
    <div
      className={`flex items-center gap-3 bg-white border ${border} rounded-xl px-4 py-3`}
    >
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800 leading-none">{count}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function FieldRow({
  label,
  value,
  icon,
}: {
  label: string
  value: string | null
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <span
        className={`text-sm font-semibold ${value ? "text-blue-600" : "text-gray-300"}`}
      >
        {value ?? "—"}
      </span>
    </div>
  )
}
