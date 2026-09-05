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
  "full name":      { english: "full name",      filipino: "buong pangalan" },
  "contact number": { english: "contact number", filipino: "numero ng telepono" },
  "plate number":   { english: "plate number",   filipino: "plate number" },
  "vehicle":        { english: "vehicle",        filipino: "sasakyan" },
  "email":          { english: "email",          filipino: "email" },
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
 */
export function missingFieldsPrompt(missing: string[], lang?: BotLanguage): string {
  const plural = missing.length > 1
  const en =
    `${MISSING_FIELDS_LEADS.english}: ${localizeFields(missing, "english").join(", ")}. ` +
    `Please send ${plural ? "them" : "it"} and I'll get you set up.`
  const fil =
    `${MISSING_FIELDS_LEADS.filipino}: ${localizeFields(missing, "filipino").join(", ")}. ` +
    `Pakipadala ${plural ? "ang mga ito" : "ito"} at ihahanda ko na ang booking mo.`
  return pickCopy(lang, en, fil)
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

/** Bot has handed the conversation to a human. */
export function escalationAck(lang?: BotLanguage): string {
  return pickCopy(
    lang,
    "Thanks for reaching out to 826 Auto Care! I've passed this conversation to our team, " +
      "and a staff member will follow up with you here personally. " +
      "I won't be able to send automated replies on this chat until your request has been resolved.",
    "Salamat sa pag-message sa 826 Auto Care! Naipasa ko na ang usapang ito sa aming team, " +
      "at may staff na susunod sa iyo rito nang personal. " +
      "Hindi muna ako makakapagpadala ng automated na sagot dito hanggang matugunan ang iyong request.",
  )
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

/** A capability the admin switched off was requested. */
export function capabilityDisabled(
  capability: "services" | "booking" | "status",
  lang?: BotLanguage,
): string {
  const en: Record<typeof capability, string> = {
    services: "service and pricing questions",
    booking:  "bookings",
    status:   "vehicle status updates",
  }
  const fil: Record<typeof capability, string> = {
    services: "mga tanong tungkol sa serbisyo at presyo",
    booking:  "booking",
    status:   "update sa status ng sasakyan",
  }
  return pickCopy(
    lang,
    `Sorry — I'm not able to help with ${en[capability]} right now. ` +
      "I'm passing you to our team, and a staff member will follow up with you here.",
    `Pasensya na — hindi ko po matutulungan sa ${fil[capability]} sa ngayon. ` +
      "Ipapasa ko kayo sa aming team, at may staff na kakausap sa inyo rito.",
  )
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

/** Quick-reply button labels. Menus are short, so `both` uses "EN / FIL". */
export const QUICK_REPLY_LABELS: Record<string, { english: string; filipino: string }> = {
  services: { english: "Services & Prices", filipino: "Serbisyo at Presyo" },
  booking:  { english: "Booking",           filipino: "Magpa-book" },
  report:   { english: "Report a Concern",  filipino: "Mag-report" },
  status:   { english: "Vehicle Status",    filipino: "Status ng Sasakyan" },
}

/**
 * Messenger caps quick-reply titles at 20 characters, so `both` cannot show
 * two languages side by side — Filipino is used, matching how a bilingual shop
 * would label its own menu.
 */
export function quickReplyLabel(payload: string, lang?: BotLanguage): string | null {
  const entry = QUICK_REPLY_LABELS[payload]
  if (!entry) return null
  return lang === "filipino" || lang === "both" ? entry.filipino : entry.english
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
    filipino: { plate: "Plate", status: "Status", service: "Serbisyo", progress: "Progreso", stagesDone: "yugto ang tapos", currently: "kasalukuyan", eta: "Tinatayang Matatapos" },
  },
} as const
