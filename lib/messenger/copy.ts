/**
 * Every fixed (non-AI) customer-facing message, in one place and language-aware.
 *
 * The `language` setting used to reach only Gemini's free-text answers, while
 * all deterministic replies — the booking summary, missing-field re-asks,
 * escalation notices, status text, quick-reply labels — were hardcoded English.
 * A shop set to Filipino therefore got a mix of both, which is why these live
 * here now instead of being inlined at each call site.
 *
 * Pure module: no Supabase, no Gemini, safe to import anywhere and unit-test.
 */

import {
  DEFAULT_ESCALATION_MESSAGE_EN,
  DEFAULT_ESCALATION_MESSAGE_FIL,
  DEFAULT_RESOLVED_MESSAGE_EN,
  DEFAULT_RESOLVED_MESSAGE_FIL,
} from "@/types/chatbot"

export type BotLanguage = "english" | "filipino" | "both"

/**
 * Picks the wording for the configured language. `both` sends the English text
 * followed by the Filipino one, separated by a blank line, so neither audience
 * has to guess.
 */
export function pickCopy(lang: BotLanguage | undefined, en: string, fil: string): string {
  if (lang === "filipino") return fil
  if (lang === "both") return `${en}\n\n${fil}`
  return en
}

/** A resolved English + Filipino pair, ready for `pickCopy`. */
export interface MessageTemplate {
  en: string
  fil: string
}

/**
 * Resolves one of the five admin-editable "Message Templates" against its
 * built-in default: an admin value wins only when actually filled in (both
 * languages are required in the admin UI, but this stays defensive for a
 * legacy/partially-seeded settings row). Centralizes the "admin override, else
 * hardcoded default" pattern used by every template-backed message below.
 */
export function resolveTemplate(
  en: string | null | undefined,
  fil: string | null | undefined,
  fallbackEn: string,
  fallbackFil: string,
): MessageTemplate {
  return {
    en: en?.trim() || fallbackEn,
    fil: fil?.trim() || fallbackFil,
  }
}

/** Language-specific lead-ins for the deterministic missing-fields re-ask. */
export const MISSING_FIELDS_LEADS = {
  english:  "To continue your booking, please include",
  filipino: "Para maituloy ang iyong booking, pakisama",
} as const

/**
 * Every lead-in the re-ask has ever used. The webhook scans conversation
 * history for these prefixes to detect a stuck re-ask loop, and history can
 * contain messages written before the language was changed — so the guard must
 * match all of them, not just the current language.
 */
export const ALL_MISSING_FIELDS_LEADS: string[] = [
  MISSING_FIELDS_LEADS.english,
  MISSING_FIELDS_LEADS.filipino,
]

const FIELD_LABELS: Record<string, { english: string; filipino: string }> = {
  "full name":      { english: "full name",      filipino: "Buong pangalan" },
  "contact number": { english: "contact number", filipino: "Numero ng telepono" },
  "plate number":   { english: "plate number",   filipino: "Plate number" },
  "vehicle":        { english: "vehicle",        filipino: "Sasakyan (brand at model)" },
  "email":          { english: "email",          filipino: "Email address" },
  // The labels missingBookingFields actually passes for these two. Without
  // them the Filipino re-ask left "Vehicle Unit" and "Email Address" in English.
  "vehicle unit":   { english: "vehicle unit",   filipino: "Sasakyan (brand at model)" },
  "email address":  { english: "email address",  filipino: "Email address" },
}

/**
 * English keeps the caller's labels verbatim (they're already display-ready,
 * e.g. "Plate Number"); only Filipino substitutes a translation, falling back
 * to the original for anything unmapped.
 */
function localizeFields(fields: string[], lang: BotLanguage | undefined): string[] {
  if (lang !== "filipino") return fields
  return fields.map((f) => FIELD_LABELS[f.toLowerCase()]?.filipino ?? f)
}

/**
 * The deterministic re-ask for still-missing booking fields. The English
 * wording is unchanged from before this module existed — the loop guard and its
 * tests depend on the exact lead-in, and there was no reason to reword it.
 *
 * Several fields are laid out one per line, like the booking summary: joined
 * with commas they made one dense paragraph in a chat bubble. The lead-in
 * must stay the very start of the message either way (see MISSING_FIELDS_LEADS).
 */
export function missingFieldsPrompt(missing: string[], lang?: BotLanguage): string {
  const plural = missing.length > 1
  const body = (lead: string, fields: string[], closing: string) =>
    plural
      ? `${lead}:\n${fields.map((f) => `• ${f}`).join("\n")}\n\n${closing}`
      : `${lead}: ${fields.join(", ")}.\n\n${closing}`
  const en = body(
    MISSING_FIELDS_LEADS.english,
    localizeFields(missing, "english"),
    `Please send ${plural ? "them" : "it"} and I'll get you set up.`,
  )
  const fil = body(
    MISSING_FIELDS_LEADS.filipino,
    localizeFields(missing, "filipino"),
    `Pakipadala ${plural ? "ang mga ito" : "ito"} at ihahanda ko na ang booking mo.`,
  )
  return pickCopy(lang, en, fil)
}

/**
 * Appended after an ordinary answer when the customer asks something in the
 * middle of a booking, so they know the booking is still open. The webhook
 * also looks for this text in the bot's last message to recognise that the
 * next short reply is a booking detail (see answersDetailPrompt).
 */
export const BOOKING_RESUME_REMINDERS = {
  english:  "Whenever you're ready, send your remaining details and I'll continue your booking.",
  filipino: "Kapag handa ka na, ipadala lang ang natitirang detalye at itutuloy ko ang booking mo.",
} as const

export const ALL_BOOKING_RESUME_REMINDERS: string[] = [
  BOOKING_RESUME_REMINDERS.english,
  BOOKING_RESUME_REMINDERS.filipino,
]

export function bookingResumeReminder(lang?: BotLanguage): string {
  return pickCopy(lang, BOOKING_RESUME_REMINDERS.english, BOOKING_RESUME_REMINDERS.filipino)
}

/** Header + confirm prompt for the booking-details summary. */
export const BOOKING_SUMMARY_COPY = {
  header: {
    english:  "Please review your booking details:",
    filipino: "Pakisuri ang mga detalye ng iyong booking:",
  },
  confirm: {
    english:  "Reply YES to confirm, or send the correct value for anything that's wrong.",
    filipino: "I-reply ang YES para kumpirmahin, o ipadala ang tamang detalye kung may mali.",
  },
  labels: {
    english:  { name: "Name", contact: "Contact", plate: "Plate", vehicle: "Vehicle", email: "Email" },
    filipino: { name: "Pangalan", contact: "Contact", plate: "Plate", vehicle: "Sasakyan", email: "Email" },
  },
} as const

/**
 * Closed set of customer-safe escalation reasons — deliberately opt-in. Only
 * these exact keys, with this hand-authored wording, can ever reach a
 * customer; an escalation trigger with no entry here (or explicitly passed
 * `null`/`undefined`) falls back to the fully generic message with no reason
 * clause at all. Some internal escalation reasons (a link-conflict flagged as
 * possible impersonation, an identity-conflict note naming another customer's
 * on-file details, the model's own unvetted free-text reason) must NEVER be
 * surfaced here — see the callers in app/api/webhook/facebook/route.ts.
 */
export type EscalationReason =
  | "human_requested"
  | "report"
  | "vehicle_in_service"
  | "stuck_details"
  | "booking_ready"
  | "job_order_unrecognized"
  | "violation"
  | "hiccup"

const ESCALATION_REASON_COPY: Record<EscalationReason, { english: string; filipino: string }> = {
  human_requested:         { english: "You'd like to speak with our team directly.",              filipino: "Gusto mong makausap ang aming team nang direkta." },
  report:                  { english: "You'd like to report a concern.",                          filipino: "Gusto mong mag-report ng concern." },
  vehicle_in_service:      { english: "Your vehicle already has an active job with us.",           filipino: "May kasalukuyan ka nang trabaho sa amin para sa sasakyang ito." },
  stuck_details:           { english: "I want to make sure we get your booking details exactly right.", filipino: "Gusto kong siguraduhing tama ang mga detalye ng iyong booking." },
  booking_ready:           { english: "Your booking details are complete.",                       filipino: "Kumpleto na ang mga detalye ng iyong booking." },
  job_order_unrecognized:  { english: "I wasn't able to verify the Job Order ID you sent.",      filipino: "Hindi ko na-verify ang Job Order ID na ipinadala mo." },
  violation:               { english: "Let's continue this with a member of our team.",            filipino: "Ipagpapatuloy na natin ito kasama ang isang miyembro ng aming team." },
  hiccup:                  { english: "I ran into a small hiccup on my end.",                      filipino: "Nagkaroon ako ng maliit na hiccup sa aking sistema." },
}

/**
 * Bot has handed the conversation to a human. `baseTemplate` is the
 * admin-editable "Human Escalation Message Template" (already resolved
 * against its default via `resolveTemplate` by the caller). The per-reason
 * clause is prepended as its own standalone leading sentence rather than
 * spliced into the base text — those clauses are chosen specifically to
 * never leak internal detail (see `EscalationReason`'s doc comment) and must
 * keep working no matter how an admin rewords the base template, so this
 * deliberately does not depend on matching any particular phrase in it.
 */
export function escalationAck(
  lang?: BotLanguage,
  reason?: EscalationReason | null,
  baseTemplate?: MessageTemplate,
): string {
  const r = reason ? ESCALATION_REASON_COPY[reason] : null
  const base = baseTemplate ?? { en: DEFAULT_ESCALATION_MESSAGE_EN, fil: DEFAULT_ESCALATION_MESSAGE_FIL }

  const en = r ? `${r.english} ${base.en}` : base.en
  const fil = r ? `${r.filipino} ${base.fil}` : base.fil

  return pickCopy(lang, en, fil)
}

/** Customer wants to change/cancel a booking already on file. */
export function existingBookingHandoff(lang?: BotLanguage): string {
  return pickCopy(
    lang,
    "I'll connect you with our team for your existing booking. They'll follow up with you here — " +
      "I won't send automated replies in the meantime.",
    "Ikokonekta kita sa aming team para sa iyong kasalukuyang booking. Sila na ang kakausap sa iyo rito — " +
      "hindi muna ako magpapadala ng automated na sagot sa ngayon.",
  )
}

/**
 * Fixed off-topic redirect. Overrides the model's own free-text output for
 * the same intent (the classification itself — `violation: "off_topic"` —
 * still comes from Gemini; see HARD_GUARDRAIL in lib/messenger/chatbot.ts)
 * so the exact wording and language always match reviewed, program-authored
 * copy instead of a live translation the model has to get right every time.
 */
export function offTopicRedirect(lang?: BotLanguage): string {
  return pickCopy(
    lang,
    "I can only assist with questions about 826 Auto Care's services. Is there anything I can help you with regarding our services?",
    "Makakatulong lang po ako sa mga tanong tungkol sa mga serbisyo ng 826 Auto Care. May maitutulong ba ako sa inyo may kinalaman sa aming mga serbisyo?",
  )
}

/** Customer abandoned the booking they were giving details for. */
export function bookingCancelled(lang?: BotLanguage): string {
  return pickCopy(
    lang,
    "No problem — I've cancelled that booking request and cleared the details you sent. " +
      "If you'd like to book later, just message me and we'll start fresh. " +
      "Anything else I can help you with?",
    "Walang problema — kinansela ko na ang booking request na iyon at binura ang mga detalyeng ipinadala mo. " +
      "Kung gusto mong mag-book mamaya, mag-message ka lang at magsisimula tayo ulit. " +
      "May iba pa ba akong maitutulong?",
  )
}

/**
 * Sent (with the quick-reply menu) when Sales concludes a handoff and the bot
 * resumes. `template` is the admin-editable "Resolved Message Template"
 * (already resolved against its default via `resolveTemplate` by the caller).
 */
export function resolvedMessage(lang?: BotLanguage, template?: MessageTemplate): string {
  const t = template ?? { en: DEFAULT_RESOLVED_MESSAGE_EN, fil: DEFAULT_RESOLVED_MESSAGE_FIL }
  return pickCopy(lang, t.en, t.fil)
}

/** Warnings issued before the violation ladder escalates. */
export function violationWarning(kind: "policy" | "offtopic", lang?: BotLanguage): string {
  if (kind === "policy") {
    return pickCopy(
      lang,
      " I can only help with 826 Auto Care topics, and I need our chat to stay respectful — if this continues I'll pass you to our team.",
      " Tungkol lang po sa 826 Auto Care ang matutulungan ko, at kailangang maging magalang ang usapan — kung magpapatuloy ito, ipapasa ko kayo sa aming team.",
    )
  }
  return pickCopy(
    lang,
    " Note: if you keep sending messages unrelated to our services, I'll hand this conversation to our Sales team.",
    " Paalala: kung patuloy kayong magpapadala ng mensaheng walang kinalaman sa aming serbisyo, ipapasa ko ang usapang ito sa aming Sales team.",
  )
}

/**
 * First "complaint" classification in a conversation: ask, don't freeze. A
 * direct "Report a Concern" tap or report keyword still bypasses this
 * entirely and escalates immediately (see `violationHandled` in
 * app/api/webhook/facebook/route.ts) — this is only for an AI classification
 * of ambiguous/mild wording, which gets one clarifying reply before a second
 * consecutive complaint-classified message escalates for real.
 */
export function complaintClarify(lang?: BotLanguage): string {
  return pickCopy(
    lang,
    "I'm sorry to hear that. Just so this reaches the right person — could you tell me a bit " +
      "more about what happened? Or tap \"Report a Concern\" below and I'll connect you with " +
      "our team right away.",
    "Pasensya na po sa naranasan ninyo. Para masiguradong maabot nito ang tamang tao — " +
      "maaari ba ninyong ikuwento nang kaunti ang nangyari? O pindutin ang \"Mag-report ng " +
      "Concern\" sa baba at ikokonekta ko kayo agad sa aming team.",
  )
}

/** Quick-reply button labels. Menus are short, so `both` picks one language. */
export const QUICK_REPLY_LABELS: Record<string, { english: string; filipino: string }> = {
  services: { english: "Services & Prices", filipino: "Serbisyo at Presyo" },
  booking:  { english: "Booking",           filipino: "Request ng Booking" },
  report:   { english: "Report a Concern",  filipino: "Mag-report ng Concern" },
  status:   { english: "Vehicle Status",    filipino: "Status ng Sasakyan" },
}

/**
 * Common Filipino function words — the same handful of particles almost any
 * Filipino or Taglish sentence contains at least one of, even a short one.
 * Word-boundary matched, case-insensitive.
 */
const FILIPINO_MARKERS =
  /\b(ang|mga|ng|nang|sa|ko|mo|niya|natin|namin|nila|kayo|sila|hindi|oo|opo|po|ba|na|yung|yun|ito|iyon|paano|gusto|pwede|puwede|salamat|magkano|meron|wala|kailan|saan|sino|paki|pakisuri|pakipadala|kumusta|kamusta|magandang|umaga|hapon|gabi|ako|ikaw|kami|tayo|akin|inyo|ano|bakit|kelan|nasaan|asan|ilan|ilang|gaano|lang|naman|rin|nga|daw|kasi|pero|sana|sige|talaga|siguro|tapos|matatapos|ngayon|bukas|mamaya|kahapon|dito|diyan|doon|yan|kotse|sasakyan|presyo|serbisyo|tanong|kunin|magpa\w+|nagpa\w+|pa-?book|pa-?schedule)\b/i

/**
 * English function words: enough to tell a customer has actually switched to
 * English, as opposed to sending something with no language in it at all
 * ("ok", a plate number, a name). Deliberately leaves out words Filipino
 * speakers drop into Tagalog chats (hi, hello, ok, yes, no, thanks) and ones
 * that are also Tagalog ("at", "may").
 */
const ENGLISH_MARKERS =
  /\b(the|is|are|was|were|how|much|what|when|where|why|who|which|can|could|would|should|will|do|does|did|i|my|me|you|your|we|our|please|want|need|like|have|has|had|for|with|about|this|that|it|there|to|of|and|or|but|if|not|in|on|from|any|some)\b/i

/**
 * Guesses whether a message is Filipino/Taglish or English, for callers that
 * need a single-language decision (quick-reply button titles) when the shop's
 * Response Language is "both". A per-message heuristic, not a persisted
 * conversation preference — see `quickReplyLabel`.
 */
export function detectMessageLanguage(text: string | null | undefined): "english" | "filipino" {
  return text && FILIPINO_MARKERS.test(text) ? "filipino" : "english"
}

/** The language of a quick-reply button, when `text` is exactly one of the labels. */
function quickReplyTitleLanguage(text: string): "english" | "filipino" | null {
  const t = text.trim().toLowerCase()
  for (const label of Object.values(QUICK_REPLY_LABELS)) {
    if (label.filipino.toLowerCase() === t) return "filipino"
    if (label.english.toLowerCase() === t) return "english"
  }
  return null
}

/** One message's language, or null when it gives no signal either way. */
function decisiveLanguage(text: string | null | undefined): "english" | "filipino" | null {
  if (!text) return null
  // A tap arrives as the button's own title: keep the language of the button
  // the customer chose, whatever words the title happens to contain.
  const tapped = quickReplyTitleLanguage(text)
  if (tapped) return tapped
  // Checked before English so Taglish counts as Filipino, same as detectMessageLanguage.
  if (FILIPINO_MARKERS.test(text)) return "filipino"
  if (ENGLISH_MARKERS.test(text)) return "english"
  return null
}

/**
 * The language for this turn's fixed replies and quick-reply buttons.
 *
 * `detectMessageLanguage` judges one message alone and calls anything without
 * a Filipino word English, which flipped a Tagalog conversation to English
 * buttons whenever the customer tapped a button, replied "ok", or sent a plate
 * or phone number. This keeps the conversation's language through those:
 * a message with no signal inherits from the customer's most recent message
 * that had one. A customer still switches by writing an actual English (or
 * Filipino) sentence.
 *
 * `priorCustomerMessages` is oldest first, the order getConversationHistory
 * returns. Defaults to English when nothing in the conversation is decisive.
 */
export function resolveTurnLanguage(
  message: string | null | undefined,
  priorCustomerMessages: readonly (string | null | undefined)[] = [],
): "english" | "filipino" {
  const current = decisiveLanguage(message)
  if (current) return current
  for (let i = priorCustomerMessages.length - 1; i >= 0; i--) {
    const earlier = decisiveLanguage(priorCustomerMessages[i])
    if (earlier) return earlier
  }
  return "english"
}

/**
 * Messenger caps quick-reply titles at 20 characters, so `both` cannot show
 * two languages side by side. `detected` (from `detectMessageLanguage`, keyed
 * off the customer's own last message) picks which one; when it's not
 * supplied, "both" falls back to Filipino, matching the previous fixed
 * behavior for any caller that can't provide the customer's text.
 */
export function quickReplyLabel(
  payload: string,
  lang?: BotLanguage,
  detected?: "english" | "filipino",
): string | null {
  const entry = QUICK_REPLY_LABELS[payload]
  if (!entry) return null
  if (lang === "both") return detected === "english" ? entry.english : entry.filipino
  return lang === "filipino" ? entry.filipino : entry.english
}

/** Deterministic vehicle-status wording. */
export const STATUS_COPY = {
  bookedNoActiveJob: (plate: string | null | undefined, lang?: BotLanguage) => {
    const p = plate ? ` for plate ${plate}` : ""
    const pf = plate ? ` para sa plate ${plate}` : ""
    return pickCopy(
      lang,
      `Good news — we have your booking${p} on file. It hasn't been scheduled into service yet; ` +
        "our team will update you here as soon as work begins.",
      `Magandang balita — nakalista na ang iyong booking${pf}. Hindi pa ito naka-schedule sa serbisyo; ` +
        "ia-update ka ng aming team dito sa oras na magsimula ang trabaho.",
    )
  },
  noVehicleInService: (lang?: BotLanguage) =>
    pickCopy(
      lang,
      "You don't have a vehicle in service with us right now. If you've just booked, " +
        "we'll get started once your vehicle is checked in — and I'll have an update for you here.",
      "Wala kang sasakyan na kasalukuyang nasa serbisyo namin ngayon. Kung kaka-book mo lang, " +
        "magsisimula kami kapag na-check in na ang iyong sasakyan — at bibigyan kita ng update dito.",
    ),
  latestHeader: (plural: boolean, lang?: BotLanguage) =>
    pickCopy(
      lang,
      plural ? "Here's the latest on your vehicles:" : "Here's the latest on your vehicle:",
      plural ? "Narito ang pinakabagong update sa iyong mga sasakyan:" : "Narito ang pinakabagong update sa iyong sasakyan:",
    ),
  jobLabels: {
    english:  { plate: "Plate", status: "Status", service: "Service", progress: "Progress", stagesDone: "stages done", currently: "currently", eta: "Estimated Completion" },
    filipino: { plate: "Plate", status: "Status", service: "Serbisyo", progress: "Progreso", stagesDone: "natapos na stages", currently: "kasalukuyan", eta: "Tinatayang Matatapos" },
  },
} as const
