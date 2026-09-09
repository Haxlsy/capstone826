"use client"

import { useState, useRef, useEffect } from "react"
import { Send, RotateCcw, Bot, Sparkles } from "lucide-react"
import { type ChatbotSettings, type ChatMessage } from "@/types/chatbot"

interface Message {
  role: "user" | "bot"
  text: string
  time: string
}

const EXAMPLE_QUESTIONS: Record<"english" | "filipino" | "both", string[]> = {
  english: [
    "What are your business hours?",
    "Where are you located?",
    "Can I check my service status?",
    "I want to book a service",
  ],
  filipino: [
    "Anong oras kayo bukas?",
    "Saan kayo matatagpuan?",
    "Pwede ko bang tingnan ang status ng aking serbisyo?",
    "Gusto kong mag-book ng serbisyo",
  ],
  both: [
    "What are your business hours?",
    "Saan kayo matatagpuan?",
    "Can I check my service status?",
    "Gusto kong mag-book ng serbisyo",
  ],
}

function getTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export default function ChatbotPreview({ settings }: { settings: ChatbotSettings }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setError(null)
    const userMsg: Message = { role: "user", text: trimmed, time: getTime() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      text: m.text,
    }))

    try {
      const res = await fetch("/api/admin/chatbot/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history, settings }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to get response.")
      setMessages((prev) => [...prev, { role: "bot", text: json.reply ?? "…", time: getTime() }])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again."
      setError(msg)
      setMessages((prev) => prev.slice(0, -1))
      setInput(trimmed)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function reset() {
    setMessages([])
    setError(null)
    setInput("")
  }

  const isEmpty = messages.length === 0 && !loading

  return (
    <div className="flex flex-col h-full w-full bg-surface border border-border rounded-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            826
          </div>
          <div>
            <p className="text-sm font-semibold text-heading leading-none">Chatbot Preview</p>
            <p className="text-[11px] text-muted mt-0.5">See how your AI will respond.</p>
          </div>
        </div>
        <button
          onClick={reset}
          title="Clear conversation"
          className="p-1.5 text-muted hover:text-body rounded-sm hover:bg-surface-muted transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
            <div className="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-muted" />
            </div>
            <p className="text-xs text-muted max-w-[160px]">
              Ask a question below to test your chatbot&apos;s responses.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "items-end gap-2"}`}>
            {m.role === "bot" && (
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold shrink-0 mb-4">
                826
              </div>
            )}
            <div className={`max-w-[82%] flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`px-3 py-2.5 rounded-card text-[12px] leading-relaxed whitespace-pre-wrap break-words ${
                  m.role === "user"
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-surface-subtle border border-border text-body rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
              <p className="text-[10px] text-muted px-1">{m.time}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold shrink-0 mb-4">
              826
            </div>
            <div className="bg-surface-subtle border border-border rounded-card rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-3">
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Example questions — only when empty */}
      {isEmpty && (
        <div className="px-4 pb-3 flex flex-col gap-2 shrink-0">
          <p className="text-[11px] font-medium text-muted uppercase tracking-wide">Try these example questions</p>
          <div className="flex flex-col gap-1.5">
            {EXAMPLE_QUESTIONS[settings.language].map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-left text-[12px] px-3 py-2 rounded-card border border-border text-body hover:bg-surface-muted hover:border-border transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="px-4 pb-2 text-[11px] text-status-delayed shrink-0">{error}</p>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-border-subtle shrink-0">
        <div className="flex items-center gap-2 border border-border rounded-card px-3 py-2 bg-surface focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-shadow">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Type your message…"
            className="flex-1 text-sm text-body bg-transparent focus:outline-none placeholder:text-muted min-w-0"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center text-white hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Notice */}
      <div className="mx-4 mb-3 flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-card px-3 py-2.5 shrink-0">
        <Bot className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] text-primary leading-relaxed">
          <strong>Preview uses your current settings.</strong>{" "}
          Changes apply instantly — no need to save first.
        </p>
      </div>
    </div>
  )
}
