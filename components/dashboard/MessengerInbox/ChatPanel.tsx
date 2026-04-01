"use client"

import { useState, useRef, useEffect } from "react"
import { Paperclip, FileText, Send, ChevronUp, ChevronDown, ExternalLink, AlertCircle } from "lucide-react"
import type { Conversation } from "./MessengerInbox"

interface Props {
  conversation: Conversation
  onSend: (text: string) => void
}

const statusBadge: Record<string, string> = {
  "Awaiting Reply": "bg-yellow-100 text-yellow-700",
  "Vehicle Inquiry": "bg-orange-100 text-orange-600",
  "Replied": "bg-green-100 text-green-600",
}

const jobStatusBadge: Record<string, string> = {
  Ongoing: "bg-blue-100 text-blue-600",
  Delayed: "bg-red-100 text-red-500",
  Completed: "bg-green-100 text-green-600",
  "Quality Check": "bg-orange-100 text-orange-500",
}

export default function ChatPanel({ conversation, onSend }: Props) {
  const [input, setInput] = useState("")
  const [jobRefOpen, setJobRefOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversation.messages])

  function handleSend() {
    if (!input.trim()) return
    onSend(input)
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isVehicleInquiry = conversation.status === "Vehicle Inquiry"

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center shrink-0">
            {conversation.initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{conversation.name}</span>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadge[conversation.status]}`}>
                {conversation.status}
              </span>
            </div>
            <p className="text-xs text-gray-400">{conversation.via}</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
          View Job Status
        </button>
      </div>

      {/* Quick Reference Banner */}
      {conversation.jobRef && (
        <div className="shrink-0 border-b border-orange-100 bg-orange-50">
          <button
            onClick={() => setJobRefOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-2.5"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-700">
                Quick Reference — {conversation.jobRef.plateNo}
              </span>
            </div>
            {jobRefOpen ? (
              <ChevronUp className="w-4 h-4 text-orange-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-orange-400" />
            )}
          </button>

          {jobRefOpen && (
            <div className="px-5 pb-3">
              <div className="grid grid-cols-5 gap-4 text-sm mb-2">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Plate No.</p>
                  <p className="font-semibold text-gray-800">{conversation.jobRef.plateNo}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Status</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${jobStatusBadge[conversation.jobRef.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {conversation.jobRef.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Service Type</p>
                  <p className="font-semibold text-gray-800">{conversation.jobRef.serviceType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Stage Progress</p>
                  <p className="font-semibold text-gray-800">{conversation.jobRef.stageProgress}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Expected Completion</p>
                  <p className="font-semibold text-gray-800">{conversation.jobRef.expectedCompletion}</p>
                </div>
              </div>
              <button className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors">
                <ExternalLink className="w-3 h-3" />
                View Full Details
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gray-50">
        {conversation.messages.map((msg, idx) => {
          if (msg.isEscalation && msg.sender === "customer") {
            return (
              <div key={msg.id}>
                {/* Escalation divider */}
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 shrink-0">[Escalated to Sales]</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {/* Customer message (left) */}
                <div className="flex justify-start">
                  <div className="max-w-[65%]">
                    <div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm">
                      {msg.text}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 ml-1">{msg.time}</p>
                  </div>
                </div>
              </div>
            )
          }

          if (msg.sender === "customer") {
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[65%]">
                  <div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm">
                    {msg.text}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 ml-1">{msg.time}</p>
                </div>
              </div>
            )
          }

          if (msg.sender === "sales") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[65%]">
                  <div className="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
                    {msg.text}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 text-right mr-1">{msg.time}</p>
                </div>
              </div>
            )
          }

          // Bot message (left)
          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[65%]">
                <p className="text-[11px] text-gray-400 mb-1 ml-1">Bot</p>
                <div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm">
                  {msg.text}
                  {msg.quickReplies && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.quickReplies.map((qr) => (
                        <span
                          key={qr}
                          className="text-xs border border-gray-300 text-gray-600 px-2.5 py-1 rounded-full"
                        >
                          {qr}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-1 ml-1">{msg.time}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Vehicle inquiry alert */}
      {isVehicleInquiry && (
        <div className="shrink-0 px-5 py-2.5 bg-red-50 border-t border-red-100 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-500 font-medium">
            This customer is requesting a vehicle status update.
          </span>
        </div>
      )}

      {/* Input Area */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-end gap-3">
        <button className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors pb-1">
          <Paperclip className="w-5 h-5" />
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none text-sm text-gray-700 placeholder-gray-400 bg-transparent focus:outline-none py-1 leading-relaxed max-h-28 overflow-y-auto"
        />
        <button className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <FileText className="w-3.5 h-3.5" />
          Use Template
        </button>
        <button
          onClick={handleSend}
          className="shrink-0 flex items-center gap-1.5 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </div>
    </div>
  )
}
