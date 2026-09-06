import { z } from "zod"

// =================================================================
// Chatbot settings
// =================================================================

export const botPersonalitySchema = z.enum(["friendly", "formal"])
export const botLanguageSchema = z.enum(["english", "filipino", "both"])

/**
 * Sent verbatim (no AI) when `enable_ai_chatbot` is off, right before the
 * conversation is handed to staff. Lives here so the admin client component can
 * use it without importing server-only Messenger code.
 */
export const DEFAULT_AI_DISABLED_MESSAGE =
  "Thanks for reaching out to 826 Auto Aesthetic and Protection! Our team will get back to " +
  "you shortly."

/**
 * Built-in wording for each of the five admin-editable "Message Templates"
 * (Chatbot Management > Message Templates), used whenever the matching
 * `*_message_en`/`*_message_fil` setting is blank. Live here — not in
 * lib/messenger/* — because the admin UI is a client component and the
 * messenger libs pull in the service-role Supabase client, which must never
 * reach the browser bundle. Seeded verbatim into `chatbot_config.settings` by
 * supabase/migrations/*_seed_chatbot_message_templates.sql so existing shops
 * see no behavior change until they actually edit a template.
 */
export const DEFAULT_VEHICLE_STATUS_MESSAGE_EN =
  "Your Messenger account isn't linked to a customer record with us yet, so I can't pull up " +
  "any active job for you.\n\n" +
  "If you'd like to link it, please send your Job Order Code — you'll find it on your receipt " +
  "or booking confirmation (it looks like JO-8X2K9F). Once I recognize it, I can give you your " +
  "vehicle status here anytime."
export const DEFAULT_VEHICLE_STATUS_MESSAGE_FIL =
  "Hindi pa naka-link ang iyong Messenger account sa isang customer record namin, kaya hindi ko " +
  "makuha ang aktibong trabaho para sa iyo.\n\n" +
  "Kung gusto mong i-link ito, pakipadala ang iyong Job Order Code — makikita mo ito sa iyong " +
  "resibo o booking confirmation (mukhang ganito: JO-8X2K9F). Kapag nakilala ko na ito, " +
  "mabibigyan na kita ng update sa status ng iyong sasakyan dito anumang oras."

export const DEFAULT_LINK_VERIFICATION_MESSAGE_EN =
  "I couldn't verify a Job Order Code from that message. Please double-check it and send it " +
  "again — it looks like this:\n\n" +
  "JO-8X2K9F\n\n" +
  "You'll find it on your receipt or booking confirmation. If you're sure it's correct, " +
  "I'll pass this to our Sales team to verify for you."
export const DEFAULT_LINK_VERIFICATION_MESSAGE_FIL =
  "Hindi ko na-verify ang Job Order Code mula sa mensaheng iyon. Paki-check ulit at ipadala " +
  "muli — mukhang ganito ito:\n\n" +
  "JO-8X2K9F\n\n" +
  "Makikita mo ito sa iyong resibo o booking confirmation. Kung sigurado kang tama ito, " +
  "ipapasa ko na ito sa aming Sales team para i-verify para sa iyo."

export const DEFAULT_ESCALATION_MESSAGE_EN =
  "Thanks for reaching out to 826 Auto Care! I've passed this conversation to our team, " +
  "and a staff member will follow up with you here personally. " +
  "I won't be able to send automated replies on this chat until your request has been resolved."
export const DEFAULT_ESCALATION_MESSAGE_FIL =
  "Salamat sa pag-message sa 826 Auto Care! Naipasa ko na ang usapang ito sa aming team, " +
  "at may staff na susunod sa iyo rito nang personal. " +
  "Hindi muna ako makakapagpadala ng automated na sagot dito hanggang matugunan ang iyong request."

export const DEFAULT_RESOLVED_MESSAGE_EN =
  "Our team has finished helping with your request. I'm back and ready to assist — " +
  "here's what I can help you with:"
export const DEFAULT_RESOLVED_MESSAGE_FIL =
  "Natapos na ng aming team ang pagtulong sa iyong request. Nandito na ako ulit at handang " +
  "tumulong — narito ang aking maitutulong sa iyo:"

export const DEFAULT_BOOKING_MESSAGE_EN =
  "Thank you! Your request has been sent to our Sales team. They will contact you shortly to " +
  "confirm your appointment."
export const DEFAULT_BOOKING_MESSAGE_FIL =
  "Salamat! Naipadala na ang iyong request sa aming Sales team. Makikipag-ugnayan sila sa iyo " +
  "sa lalong madaling panahon para kumpirmahin ang iyong appointment."

/**
 * Persisted chatbot settings. `.passthrough()` is kept so any legacy keys
 * already stored in `chatbot_config.settings` survive a save/load round trip
 * — every zod schema strips unknown keys by default. This is also what makes
 * removing a field from this schema (e.g. the old capability toggles and
 * `account_not_linked_message`/`booking_message` below) safe: a legacy row
 * still carrying those keys just has them silently ignored, same as the
 * already-deprecated `vehicle_status_template` key.
 *
 * `enable_ai_chatbot` / `enable_media_validation` are the platform-level master
 * switches; they are typed here (rather than riding along on passthrough) so
 * the runtime can actually read them. Both default to true so an existing row
 * saved before they were typed keeps working.
 *
 * The five `*_message_en`/`*_message_fil` pairs back the "Message Templates"
 * admin tab. Deliberately NOT given zod `.default()`s — both languages are
 * required there, so a missing value should surface as a real gap to fill in,
 * not silently fall back. Callers resolve a blank value against the matching
 * `DEFAULT_*_MESSAGE_EN`/`_FIL` constant above via `resolveTemplate()` in
 * lib/messenger/copy.ts.
 */
export const weekdaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])
export type Weekday = z.infer<typeof weekdaySchema>

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

/** Matches the shop's actual current hours — the default so nothing changes
 *  in production until an admin edits the new Operating Hours setting. */
export const DEFAULT_OPERATING_DAYS: Weekday[] = ["tue", "wed", "thu", "fri", "sat", "sun"]
export const DEFAULT_OPERATING_OPEN_TIME  = "08:00"
export const DEFAULT_OPERATING_CLOSE_TIME = "20:00"

export const chatbotSettingsSchema = z.object({
  personality:             botPersonalitySchema,
  enable_ai_chatbot:       z.boolean().default(true),
  enable_media_validation: z.boolean().default(true),
  ai_disabled_message:     z.string().max(2000).default(DEFAULT_AI_DISABLED_MESSAGE),
  language:                botLanguageSchema,
  operating_days:                z.array(weekdaySchema).default(DEFAULT_OPERATING_DAYS),
  operating_open_time:           z.string().default(DEFAULT_OPERATING_OPEN_TIME),
  operating_close_time:          z.string().default(DEFAULT_OPERATING_CLOSE_TIME),
  vehicle_status_message_en:       z.string().max(2000),
  vehicle_status_message_fil:      z.string().max(2000),
  link_verification_message_en:    z.string().max(2000),
  link_verification_message_fil:   z.string().max(2000),
  escalation_message_en:           z.string().max(2000),
  escalation_message_fil:          z.string().max(2000),
  resolved_message_en:             z.string().max(2000),
  resolved_message_fil:            z.string().max(2000),
  booking_message_en:              z.string().max(2000),
  booking_message_fil:             z.string().max(2000),
}).passthrough()

export type ChatbotSettings = z.infer<typeof chatbotSettingsSchema>

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
}

function fmtTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":")
  const h = Number(hStr) || 0
  const m = Number(mStr) || 0
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}:00 ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`
}

/**
 * Turns the structured Operating Hours setting into the same sentence shape
 * customers/the AI previously saw as free-text knowledge-base content — e.g.
 * "Tuesday to Sunday, 8:00 AM to 8:00 PM. Closed on Mondays." Pure — lives
 * here (not lib/messenger/chatbot.ts, which is server-only) so both the admin
 * client's live preview and every server-side caller (chatbot prompt, "For
 * Release" customer message) share one implementation and can never drift
 * into disagreeing wording.
 */
export function formatOperatingHours(
  s: Pick<ChatbotSettings, "operating_days" | "operating_open_time" | "operating_close_time">,
): string {
  const openDays = s.operating_days ?? []
  if (openDays.length === 0) return "Operating hours have not been set yet."

  const ordered = WEEKDAYS.filter((d) => openDays.includes(d))
  const ranges: Weekday[][] = []
  for (const d of ordered) {
    const current = ranges.at(-1)
    const lastDay = current?.at(-1)
    if (current && lastDay && WEEKDAYS.indexOf(lastDay) === WEEKDAYS.indexOf(d) - 1) {
      current.push(d)
    } else {
      ranges.push([d])
    }
  }
  const dayText = ranges
    .map((r) => (r.length > 1 ? `${WEEKDAY_LABELS[r[0]]} to ${WEEKDAY_LABELS[r.at(-1)!]}` : WEEKDAY_LABELS[r[0]]))
    .join(", ")

  const timeText = `${fmtTime12h(s.operating_open_time || DEFAULT_OPERATING_OPEN_TIME)} to ${fmtTime12h(s.operating_close_time || DEFAULT_OPERATING_CLOSE_TIME)}`

  let text = `${dayText}, ${timeText}.`

  const closedDays = WEEKDAYS.filter((d) => !openDays.includes(d))
  if (closedDays.length > 0) {
    text += ` Closed on ${closedDays.map((d) => `${WEEKDAY_LABELS[d]}s`).join(" and ")}.`
  }

  return text
}

// =================================================================
// Knowledge base
// =================================================================

export const kbCategorySchema = z.enum(["Service", "Pricing", "FAQ", "Other"])
export type KBCategory = z.infer<typeof kbCategorySchema>

export const KB_CATEGORIES = kbCategorySchema.options as KBCategory[]

export const KB_CATEGORY_COLORS: Record<KBCategory, string> = {
  Service: "bg-blue-50 text-blue-600 border-blue-200",
  Pricing: "bg-green-50 text-green-600 border-green-200",
  FAQ:     "bg-purple-50 text-purple-600 border-purple-200",
  Other:   "bg-gray-100 text-gray-500 border-gray-200",
}

export const kbEntrySchema = z.object({
  id:         z.string(),
  category:   kbCategorySchema,
  topic:      z.string(),
  content:    z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type KBEntry = z.infer<typeof kbEntrySchema>

export const kbCreateSchema = z.object({
  topic:    z.string().trim().min(1, "Topic is required.").max(255),
  content:  z.string().min(1, "Content is required.").max(10000),
  category: kbCategorySchema.default("FAQ"),
})
export type KBEntryCreate = z.infer<typeof kbCreateSchema>

export const kbUpdateSchema = z
  .object({
    topic:    z.string().trim().min(1, "Topic is required.").max(255).optional(),
    content:  z.string().min(1, "Content is required.").max(10000).optional(),
    category: kbCategorySchema.optional(),
  })
  .refine((v) => v.topic !== undefined || v.content !== undefined || v.category !== undefined, {
    message: "Nothing to update.",
  })
export type KBEntryUpdate = z.infer<typeof kbUpdateSchema>

// =================================================================
// Messenger conversation / reply
// =================================================================

export const chatMessageSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string(),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const customerDetailsSchema = z.object({
  full_name:      z.string().nullable(),
  contact_number: z.string().nullable(),
  plate_number:   z.string().nullable(),
  vehicle_unit:   z.string().nullable(),
  email:          z.string().nullable(),
})
export type CustomerDetails = z.infer<typeof customerDetailsSchema>

export const chatbotReplySchema = z.object({
  reply:             z.string(),
  escalate:          z.boolean(),
  reason:            z.string().nullable().optional(),
  violation:         z.enum(["none", "off_topic", "policy"]).optional(),
  escalation_reason: z.enum(["complaint", "cannot_answer"]).nullable().optional(),
  customer:          customerDetailsSchema.nullable().optional(),
})
export type ChatbotReply = z.infer<typeof chatbotReplySchema>