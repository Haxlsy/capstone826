import { z } from "zod"
import { TIME_ZONE } from "@/lib/time-display"

// =================================================================
// Chatbot settings
// =================================================================

export const botPersonalitySchema = z.enum(["friendly", "formal"])

/**
 * Sent verbatim (no AI) when `enable_ai_chatbot` is off, right before the
 * conversation is handed to staff. Lives here so the admin client component can
 * use it without importing server-only Messenger code.
 */
export const DEFAULT_AI_DISABLED_MESSAGE =
  "Our AI assistant isn't available right now. Thanks for reaching out to 826 Auto Aesthetic " +
  "and Protection — a member of our team will personally review your message and get back to " +
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

// Deliberately does NOT end with a colon promising an inline list — the only
// actual menu is the separate quick-reply buttons Messenger renders near the
// composer (see quickRepliesFor in lib/messenger/handoff.ts), not text under
// this message. A colon here reads as broken once nothing textual follows it.
export const DEFAULT_RESOLVED_MESSAGE_EN =
  "Our team has finished helping with your request. I'm back and ready to assist — " +
  "pick an option below or just tell me what you need."
export const DEFAULT_RESOLVED_MESSAGE_FIL =
  "Natapos na ng aming team ang pagtulong sa iyong request. Nandito na ako ulit at handang " +
  "tumulong — pumili sa mga option sa ibaba o sabihin mo lang kung ano ang kailangan mo."

export const DEFAULT_BOOKING_MESSAGE_EN =
  "Thank you! Your request has been sent to our Sales team. They will contact you shortly to " +
  "confirm your appointment."
export const DEFAULT_BOOKING_MESSAGE_FIL =
  "Salamat! Naipadala na ang iyong request sa aming Sales team. Makikipag-ugnayan sila sa iyo " +
  "sa lalong madaling panahon para kumpirmahin ang iyong appointment."

export const DEFAULT_FIRST_TIME_MESSAGE_EN =
  "Hi {name}! Welcome to 826 Auto Aesthetic & Protection - Ortigas Extension. Thanks for " +
  "messaging us! I'm our virtual assistant and I'll help you right away. If you'd like to talk " +
  "to a member of our team, just let me know."
export const DEFAULT_FIRST_TIME_MESSAGE_FIL =
  "Hi {name}! Maligayang pagdating sa 826 Auto Aesthetic & Protection - Ortigas Extension. " +
  "Salamat sa pag-message sa amin! Ako ang aming virtual assistant at tutulungan kita agad. " +
  "Kung gusto mong makausap ang aming team, sabihin mo lang."

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

/** A single admin-entered closed date — e.g. { date: "2026-12-25", label: "Christmas Day" }. */
export const holidaySchema = z.object({
  date:  z.string(),
  label: z.string(),
})
export type Holiday = z.infer<typeof holidaySchema>

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
  // No more admin-configurable Response Language — the bot always detects
  // and replies in whichever of English/Filipino the customer is using (see
  // lib/messenger/chatbot.ts buildSystemPrompt / detectMessageLanguage call
  // sites). `.passthrough()` below means a legacy stored row that still has
  // a `language` key keeps it harmlessly — nothing reads it anymore.
  operating_days:                z.array(weekdaySchema).default(DEFAULT_OPERATING_DAYS),
  operating_open_time:           z.string().default(DEFAULT_OPERATING_OPEN_TIME),
  operating_close_time:          z.string().default(DEFAULT_OPERATING_CLOSE_TIME),
  // Specific closed calendar dates (one-off — not an auto-recurring rule), on
  // top of the weekly operating_days. Treated as a real closed day everywhere
  // open-ness is checked, not just in customer-facing wording — see
  // hooks/time-utils.ts's WorkSchedule.holidayDates and
  // isWithinOperatingHours's "holiday" reason.
  holidays:                      z.array(holidaySchema).default([]),
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
  // Unlike the five above these are optional: rows (and open admin tabs) saved
  // before this template existed must keep parsing. The save schema below still
  // requires them non-blank.
  first_time_message_en:           z.string().max(2000).optional(),
  first_time_message_fil:          z.string().max(2000).optional(),
}).passthrough()

export type ChatbotSettings = z.infer<typeof chatbotSettingsSchema>

const TEMPLATE_FIELDS = [
  ["first_time", "First Time Message"],
  ["vehicle_status", "Vehicle Status"],
  ["link_verification", "Link Verification"],
  ["escalation", "Human Escalation"],
  ["resolved", "Resolved"],
  ["booking", "Booking Request Confirmation"],
] as const

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Save-time rules for the admin AI Configuration form. Returns `{ field: message }`
 * (empty = valid). Shared by the API (chatbotSettingsSaveSchema) and the client
 * so the two can't drift. Deliberately separate from chatbotSettingsSchema,
 * which stays lenient because it also parses legacy stored rows and the preview
 * request — tightening it would make reads fail.
 */
export function validateChatbotSettings(s: Partial<ChatbotSettings>): Record<string, string> {
  const errors: Record<string, string> = {}
  const rec = s as Record<string, unknown>

  for (const [key, label] of TEMPLATE_FIELDS) {
    for (const [suffix, lang] of [["en", "English"], ["fil", "Filipino"]] as const) {
      const field = `${key}_message_${suffix}`
      const v = rec[field]
      if (typeof v !== "string" || !v.trim()) errors[field] = `${label} (${lang}) message is required.`
    }
  }

  if (s.enable_ai_chatbot === false && !(s.ai_disabled_message ?? "").trim()) {
    errors.ai_disabled_message = "The auto-reply sent while the AI chatbot is off can't be empty."
  }

  if (!s.operating_days || s.operating_days.length === 0) {
    errors.operating_days = "Select at least one open day."
  }

  const open = s.operating_open_time ?? ""
  const close = s.operating_close_time ?? ""
  if (!HHMM.test(open)) errors.operating_open_time = "Enter a valid opening time."
  if (!HHMM.test(close)) errors.operating_close_time = "Enter a valid closing time."
  if (!errors.operating_open_time && !errors.operating_close_time && open >= close) {
    errors.operating_close_time = "Closing time must be after opening time."
  }

  const holidays = s.holidays ?? []
  const seenDates = new Set<string>()
  for (const h of holidays) {
    if (!ISO_DATE.test(h.date ?? "")) { errors.holidays = "Enter a valid date for every holiday."; break }
    if (!h.label?.trim()) { errors.holidays = "Enter a label for every holiday."; break }
    if (seenDates.has(h.date)) { errors.holidays = "Two holidays can't share the same date."; break }
    seenDates.add(h.date)
  }

  return errors
}

/**
 * Fills the First Time Message's `{name}` placeholder with the customer's
 * Messenger first name, or a neutral word when Facebook gave us none.
 */
/** What lib/messenger/graph.ts returns when the Facebook profile lookup fails. */
export const UNKNOWN_MESSENGER_NAME = "Messenger User"

export function renderFirstTimeMessage(
  template: string,
  fullName: string | null | undefined,
  lang: "english" | "filipino" = "english",
): string {
  const trimmed = (fullName ?? "").trim()
  const known = trimmed && trimmed.toLowerCase() !== UNKNOWN_MESSENGER_NAME.toLowerCase()
  const first = known ? trimmed.split(/\s+/)[0] : ""
  const name = first || (lang === "filipino" ? "kaibigan" : "there")
  return template.replace(/\{name\}/gi, name)
}

/** The welcome goes out only on a person's very first message, and never when the AI is off
 *  (that path already sends its own auto-reply and hands the thread to Sales). */
export function shouldSendFirstTimeMessage(opts: { isNewConversation: boolean; aiEnabled: boolean }): boolean {
  return opts.isNewConversation && opts.aiEnabled
}

/** Write-path schema: the lenient shape plus the required-field rules above. */
export const chatbotSettingsSaveSchema = chatbotSettingsSchema.superRefine((val, ctx) => {
  for (const [field, message] of Object.entries(validateChatbotSettings(val))) {
    ctx.addIssue({ code: "custom", path: [field], message })
  }
})

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
}

/** "20:00" -> "8:00 PM". Exported so a caller that needs just the bare
 *  opening/closing time (not the full formatOperatingHours sentence) can
 *  format it the same way — e.g. AddJobOrderForm's "Starts at ..." hint. */
export function fmtTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":")
  const h = Number(hStr) || 0
  const m = Number(mStr) || 0
  const period = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}:00 ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-12-25" -> "Dec 25, 2026". Parses the parts directly (never via `new
 *  Date(iso)`) so this can't shift a day off from timezone parsing of a plain
 *  calendar date that was never an instant to begin with. */
export function fmtHolidayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return `${SHORT_MONTHS[(m || 1) - 1]} ${d}, ${y}`
}

/**
 * Turns the structured Operating Hours setting into the same sentence shape
 * customers/the AI previously saw as free-text knowledge-base content — e.g.
 * "Tuesday to Sunday, 8:00 AM to 8:00 PM. Closed on Mondays." Pure — lives
 * here (not lib/messenger/chatbot.ts, which is server-only) so both the admin
 * client's live preview and every server-side caller (chatbot prompt, "For
 * Release" customer message) share one implementation and can never drift
 * into disagreeing wording.
 *
 * `now` (defaults to the real current time) scopes the holiday clause to
 * ones that haven't passed yet, so the sentence doesn't grow forever as old
 * holidays pile up in the saved list.
 */
export function formatOperatingHours(
  s: Pick<ChatbotSettings, "operating_days" | "operating_open_time" | "operating_close_time"> & { holidays?: Holiday[] },
  now: Date = new Date(),
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

  // Same en-CA/ISO-date trick used elsewhere (e.g. customer-records-export.ts)
  // to get a plain YYYY-MM-DD string in the shop's own timezone.
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now)
  const upcoming = (s.holidays ?? [])
    .filter((h) => h.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
  if (upcoming.length > 0) {
    text += ` Also closed ${upcoming.map((h) => `${fmtHolidayDate(h.date)} for ${h.label}`).join("; ")}.`
  }

  return text
}

// Date#getDay()/getHours() reflect the RUNTIME's own local timezone — correct
// in a browser (a Philippine customer's own local time) but wrong on a
// server, which on Vercel always runs in UTC regardless of account/project.
// That mismatch let a server-side check reject perfectly valid Manila
// business-hours bookings whenever UTC's hour-of-day (Manila minus 8) fell
// outside the 8am-8pm window — most of a normal morning/early-afternoon
// booking (confirmed: 10:03 AM Manila is 02:03 UTC). Always resolve
// day/hour/minute in the shop's own timezone instead, matching
// lib/time-display.ts's TIME_ZONE convention, so this gives the same answer
// no matter which timezone the calling code happens to run in.
function partsInBusinessTimeZone(date: Date): { weekday: Weekday; hour: number; minute: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    // Explicit h23 — en-US with only hour12:false can format midnight as
    // "24" instead of "0" in some engines, which would silently miscompute
    // minutes-since-midnight below.
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return {
    weekday: get("weekday").toLowerCase().slice(0, 3) as Weekday,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    // Same en-CA/ISO-date trick as formatOperatingHours, for matching against
    // a saved holiday's plain YYYY-MM-DD string.
    dateKey: new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date),
  }
}

export interface OperatingHoursCheck {
  ok: boolean
  /** Only set when `ok` is false. */
  reason?: "closed_day" | "outside_hours" | "holiday"
  /** Only set when `reason` is "holiday" — the matched holiday's label. */
  holidayLabel?: string
}

/**
 * Whether `date` (an absolute instant, evaluated in the shop's own Manila
 * timezone — never the caller's) falls inside the Operating Hours setting.
 * Pure — the client-side counterpart to hooks/time-utils.ts's addWorkingMins,
 * which answers "roll this forward to the next open instant" server-side;
 * this just answers "is this exact instant open," e.g. for validating a
 * picked Scheduled Date & Time before it's ever sent to the server (and
 * again, authoritatively, once it is).
 */
export function isWithinOperatingHours(
  s: Pick<ChatbotSettings, "operating_days" | "operating_open_time" | "operating_close_time"> & { holidays?: Holiday[] },
  date: Date,
): OperatingHoursCheck {
  const openDays = s.operating_days && s.operating_days.length > 0 ? s.operating_days : DEFAULT_OPERATING_DAYS
  const { weekday, hour, minute, dateKey } = partsInBusinessTimeZone(date)

  const holiday = (s.holidays ?? []).find((h) => h.date === dateKey)
  if (holiday) return { ok: false, reason: "holiday", holidayLabel: holiday.label }

  if (!openDays.includes(weekday)) return { ok: false, reason: "closed_day" }

  const toMins = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const openMins  = toMins(s.operating_open_time  || DEFAULT_OPERATING_OPEN_TIME)
  const closeMins = toMins(s.operating_close_time || DEFAULT_OPERATING_CLOSE_TIME)
  const mins = hour * 60 + minute
  if (mins < openMins || mins > closeMins) return { ok: false, reason: "outside_hours" }

  return { ok: true }
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
  reply:     z.string(),
  escalate:  z.boolean(),
  reason:    z.string().nullable().optional(),
  violation: z.enum(["none", "off_topic", "policy", "complaint"]).optional(),
  customer:  customerDetailsSchema.nullable().optional(),
})
export type ChatbotReply = z.infer<typeof chatbotReplySchema>