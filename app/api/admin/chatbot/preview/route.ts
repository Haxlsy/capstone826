import { NextResponse } from "next/server"
import {
  generateChatbotReply,
  loadChatbotConfig,
  loadKnowledgeBase,
  type ChatbotSettings,
} from "@/lib/messenger/chatbot"

interface HistoryItem {
  role: "user" | "model"
  text: string
}

export async function POST(request: Request) {
  try {
    const { message, history = [], settings } = (await request.json()) as {
      message: string
      history: HistoryItem[]
      settings?: ChatbotSettings
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required." }, { status: 400 })
    }

    const [knowledge, config] = await Promise.all([
      loadKnowledgeBase(),
      settings ? null : loadChatbotConfig(),
    ])

    const result = await generateChatbotReply({
      message,
      history,
      settings: settings ?? config?.settings ?? null,
      system_prompt: settings ? null : config?.system_prompt ?? null,
      knowledge,
    })

    return NextResponse.json({
      reply:    result.reply,
      escalate: result.escalate,
      reason:   result.reason,
    })
  } catch (err: unknown) {
    console.error("[chatbot-preview]", err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
