import { NextResponse } from "next/server"
import { z } from "zod"
import {
  generateChatbotReply,
  loadChatbotConfig,
  loadKnowledgeBase,
} from "@/lib/messenger/chatbot"
import { getAdminCaller } from "@/lib/auth/guard"
import { chatMessageSchema, chatbotSettingsSchema } from "@/types/chatbot"

const PreviewSchema = z.object({
  message:  z.string().trim().min(1, "message is required."),
  history:  z.array(chatMessageSchema).default([]),
  settings: chatbotSettingsSchema.optional(),
})

export async function POST(request: Request) {
  const auth = await getAdminCaller()
  if ("error" in auth) return auth.error

  try {
    const body = await request.json()
    const parsed = PreviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { message, history, settings } = parsed.data

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