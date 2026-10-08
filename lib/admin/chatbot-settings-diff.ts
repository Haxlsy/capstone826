import { TEMPLATE_FIELDS, type ChatbotSettings } from "@/types/chatbot"

const FIELD_GROUPS: { label: string; fields: (keyof ChatbotSettings)[] }[] = [
  { label: "AI Status",       fields: ["enable_ai_chatbot", "enable_media_validation", "ai_disabled_message"] },
  { label: "AI Personality",  fields: ["personality"] },
  { label: "Operating Hours", fields: ["operating_days", "operating_open_time", "operating_close_time"] },
  { label: "Holidays",        fields: ["holidays"] },
]

const differs = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b)

/**
 * Human-readable list of which settings section(s) actually changed between
 * the stored row and the incoming save, for Audit Trail's target column —
 * e.g. "Operating Hours, Booking Request Confirmation" instead of "—".
 */
export function describeChatbotSettingsChanges(
  oldSettings: ChatbotSettings | null,
  newSettings: ChatbotSettings,
): string {
  if (!oldSettings) return "Chatbot settings"

  const changed: string[] = []

  for (const group of FIELD_GROUPS) {
    if (group.fields.some((f) => differs(oldSettings[f], newSettings[f]))) changed.push(group.label)
  }

  for (const [key, label] of TEMPLATE_FIELDS) {
    const en  = `${key}_message_en` as keyof ChatbotSettings
    const fil = `${key}_message_fil` as keyof ChatbotSettings
    if (differs(oldSettings[en], newSettings[en]) || differs(oldSettings[fil], newSettings[fil])) {
      changed.push(label)
    }
  }

  return changed.length > 0 ? changed.join(", ") : "Chatbot settings"
}
