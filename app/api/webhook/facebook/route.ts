import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getOrCreateConversationByPsid,
  insertMessage,
  setConversationStatus,
  setVehicleInquiry,
  setBookingFlow,
  setAwaitingConfirmation,
  setActiveBookingOffered,
  setBookingDuplicateNotified,
  setConflictPending,
  setAwaitingLinkVerification,
  setLinkAttempts,
  setLinkConflictPending,
  setViolationStreaks,
  setBookingDraft,
  getConversationHistory,
  setLastQuickReplyPayload,
  messageAlreadyProcessed,
} from "@/lib/messenger/messenger-data"
import {
  loadChatbotConfig,
  loadKnowledgeBase,
  generateChatbotReply,
  extractCustomerDetails,
  requestedHuman,
  hasBookingIntent,
  hasStatusIntent,
  continuesStatusInquiry,
  missingBookingFields,
  confirmRequested,
  isPureConfirmation,
  isCompleteBooking,
  buildBookingSummary,
  buildMissingFieldsPrompt,
  mergeBookingDetails,
  extractDetailTokens,
  MISSING_FIELDS_PROMPT_LEAD,
  nextViolationState,
  hasExistingBookingIntent,
  hasCancelIntent,
  shouldStayInBookingFlow,
  buildBookingCancelledMessage,
  type ChatbotReply,
  type CustomerDetails,
} from "@/lib/messenger/chatbot"
import {
  lookupActiveBooking,
  formatActiveBooking,
  lookupIdentityConflict,
  isSameVehicleOnFile,
  buildDuplicateBookingNotice,
  lookupActiveJobByPlate,
  buildVehicleInServiceNotice,
} from "@/lib/messenger/booking"
import {
  sendMessengerText,
  sendMessengerQuickReply,
  fetchMessengerProfile,
  sendSenderAction,
} from "@/lib/messenger/graph"
import { QUICK_REPLIES, quickRepliesFor } from "@/lib/messenger/handoff"
import {
  resolveOwnVehicleStatus,
  formatOwnVehicleStatus,
  formatVehicleStatusForCustomer,
  buildLinkVerificationPrompt,
  assessJobOrderLinkClaim,
  normalizePlate,
  type OwnVehicleOutcome,
} from "@/lib/messenger/vehicle"
import { PLATE_PATTERN, PHONE_PATTERN, EMAIL_PATTERN, extractJobOrderCode, isLowContentAck } from "@/lib/messenger/patterns"
import {
  DEFAULT_AI_DISABLED_MESSAGE,
  DEFAULT_VEHICLE_STATUS_MESSAGE_EN,
  DEFAULT_VEHICLE_STATUS_MESSAGE_FIL,
  DEFAULT_LINK_VERIFICATION_MESSAGE_EN,
  DEFAULT_LINK_VERIFICATION_MESSAGE_FIL,
  DEFAULT_ESCALATION_MESSAGE_EN,
  DEFAULT_ESCALATION_MESSAGE_FIL,
  DEFAULT_BOOKING_MESSAGE_EN,
  DEFAULT_BOOKING_MESSAGE_FIL,
  DEFAULT_FIRST_TIME_MESSAGE_EN,
  DEFAULT_FIRST_TIME_MESSAGE_FIL,
  renderFirstTimeMessage,
  shouldSendFirstTimeMessage,
} from "@/types/chatbot"
import {
  escalationAck,
  existingBookingHandoff,
  violationWarning as violationWarningCopy,
  offTopicRedirect,
  complaintClarify,
  resolveTemplate,
  pickCopy,
  detectMessageLanguage,
  ALL_MISSING_FIELDS_LEADS,
  type BotLanguage,
  type EscalationReason,
} from "@/lib/messenger/copy"
import { logAudit } from "@/hooks/audit-helpers"
import { notifyRole } from "@/lib/notify-role"

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN!

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode")
  const token = req.nextUrl.searchParams.get("hub.verify_token")
  const challenge = req.nextUrl.searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return new Response("Forbidden", { status: 403 })
}

// Escalation ack and existing-booking handoff copy now live in
// lib/messenger/copy.ts so they follow the admin's Response Language setting
// (see escalationAck / existingBookingHandoff below).

/**
 * Reply-and-hand-off used whenever an admin setting turns a capability off —
 * the `enable_ai_chatbot` master switch, or an individual capability toggle.
 * The customer gets a real message instead of silence, and the thread is marked
 * `pending` so Sales owns it, which also makes every later message skip the bot
 * via the existing `status === "pending"` guard.
 */
async function handOffWhileDisabled(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    conversation_id: number
    senderId: string
    psidName: string
    messageBody: string
    timestamp: string
    message: string
    note?: string
  },
) {
  const { conversation_id, senderId, psidName, messageBody, timestamp, message } = opts
  const note = opts.note ?? "AI chatbot is disabled — routed to staff." 

  try {
    await setConversationStatus(conversation_id, "pending")

    const { data: newInquiry, error: inquiryErr } = await admin.from("inquiry").insert({
      messenger_name: psidName,
      psid:           senderId,
      inquiry_type:   "Human Response",
      status:         "open",
      escalated_at:   timestamp,
      last_message:   messageBody,
      conflict_note:  note,
    }).select("id").single()
    if (inquiryErr) console.error("[webhook/facebook] disabled-mode inquiry insert failed:", inquiryErr.message)

    await notifyRole(admin, "sales", {
      type:       "inquiry",
      message:    `New Human Response inquiry from ${psidName}`,
      inquiry_id: newInquiry?.id ?? null,
    })
  } catch (err) {
    console.error("[webhook/facebook] disabled-mode handoff failed:", err)
  }

  // Sent last so the customer is acknowledged even if the handoff bookkeeping
  // above partially failed.
  await sendMessengerText(senderId, message)
  await insertMessage({
    conversation_id,
    sender_type:  "bot",
    message_body: message,
    sent_at:      new Date().toISOString(),
    fb_message_id: null,
  })
}

// Report-type concern keywords used by the escalation-type resolver.
// Deliberately excludes "problema"/"issue" so casual phrases like
// "walang problema" (no problem) do not trigger a report escalation.
const REPORT_PATTERNS = [
  /\breport\b/i,
  /\bcomplaint\b/i,
  /\bconcern\b/i,
  /\breklamo\b/i,
  /\bmagreklamo\b/i,
]


/** True when the extracted customer object carries at least one real detail. */
const hasExtractedDetails = (c: CustomerDetails | null | undefined): boolean =>
  Boolean(
    c &&
    (c.full_name || c.contact_number || c.plate_number || c.vehicle_unit || c.email)
  )

// A message carries a booking signal when it either states booking intent or
// contains one of the booking detail tokens (plate / phone / email). This is
// evaluated on the CURRENT message only, so a stray detail from an older turn
// does not keep the confirmation flow glued to unrelated replies.
const bookingSignal = (text: string): boolean =>
  hasBookingIntent(text) || PLATE_PATTERN.test(text) || PHONE_PATTERN.test(text) || EMAIL_PATTERN.test(text)

interface MessengerEvent {
  sender?: { id?: string }
  recipient?: { id?: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    attachments?: unknown[]
    quick_reply?: { payload?: string }
  }
  delivery?: unknown
  read?: unknown
  postback?: unknown
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ received: false, error: "Invalid JSON" }, { status: 400 })
  }

  const events: MessengerEvent[] = (body.entry ?? []).flatMap(
    (entry: any) => entry?.messaging ?? []
  )

  const admin = createAdminClient()
  let handled = 0

  for (const messaging of events) {
    // Skip delivery / read / postback callbacks and echoed bot messages.
    if (!messaging || messaging.delivery || messaging.read || messaging.postback) continue
    const msg = messaging.message
    if (!msg || msg.is_echo) continue

    const senderId = messaging.sender?.id
    if (!senderId) continue

    try {
      await handleInboundMessage(admin, messaging)
      handled += 1
    } catch (err) {
      console.error("[webhook/facebook] event failed:", err)
    }
  }

  return NextResponse.json({ received: true, handled })
}

async function handleInboundMessage(
  admin: ReturnType<typeof createAdminClient>,
  messaging: MessengerEvent
) {
  const senderId = messaging.sender!.id!
  const timestamp = new Date(messaging.timestamp ?? Date.now()).toISOString()
  const msg = messaging.message!

  const text = (msg.text ?? "").trim()
  const hasAttachment = Array.isArray(msg.attachments) && msg.attachments.length > 0
  const messageBody = text || (hasAttachment ? "[Attachment]" : "")
  if (!messageBody) return

  const profile = await fetchMessengerProfile(senderId)

  // Get or create the conversation and capture its current status + flow flags.
  const { conversation_id, status, is_vehicle_inquiry, is_booking_flow, awaiting_confirmation, active_booking_offered, booking_duplicate_notified, conflict_pending, awaiting_link_verification, link_attempts, link_conflict_pending, offtopic_streak, policy_streak, complaint_streak, booking_draft, last_message_at, last_quick_reply_payload, is_new_conversation } =
    await getOrCreateConversationByPsid(senderId, profile.name)

  // Meta can redeliver the same webhook event (observed directly: two
  // messenger_message rows with the identical mid and millisecond timestamp
  // in a live test). Bail out before recording or replying a second time.
  if (await messageAlreadyProcessed(conversation_id, msg.mid ?? null)) return

  // Best-effort flag persistence: a failure here must not abort the reply.
  const safe = async (fn: () => Promise<unknown>) => {
    try { await fn() } catch (err) { console.error("[webhook/facebook] state persist failed:", err) }
  }

  // Tracks this turn's complaint_streak value across the several
  // setViolationStreaks() call sites below, so a fresh write earlier in the
  // turn (the first-complaint-classification branch) never gets clobbered
  // back to the stale value read above by a later, unrelated call.
  let complaintStreakNext = complaint_streak
  const auditActor = { user_id: null, user_name: profile.name || "Messenger user", role: "customer" as const }

  // Build AI history BEFORE inserting the current message.
  const history = await getConversationHistory(conversation_id)

  await insertMessage({
    conversation_id,
    sender_type: "customer",
    message_body: messageBody,
    sent_at: timestamp,
    fb_message_id: msg.mid ?? null,
  })

  // If the conversation is already escalated, Sales is handling it —
  // just record the message, do not auto-reply.
  if (status === "pending") return

  // Show the Messenger typing indicator as early as possible on every reply
  // path (deterministic hand-offs and canned replies included, not just full
  // AI turns) — there's no queue here, so the customer would otherwise see
  // nothing while up to 3 sequential Gemini calls run. Facebook clears this
  // automatically once a message is sent, so no matching typing_off is needed.
  await safe(() => sendSenderAction(senderId, "typing_on"))

  // Chatbot config is loaded here — before ANY reply path — because the
  // `enable_ai_chatbot` master switch below has to short-circuit every one of
  // them (link prompts, deterministic status/booking replies, and the Gemini
  // calls alike). It is also needed later by the vehicle-status block, which
  // uses the admin's configured "account not linked" wording.
  // Deliberately in its own try/catch: a settings-read blip must fall back to the
  // built-in defaults, NOT escalate the conversation. A model failure still
  // escalates — that stays in the generateChatbotReply try/catch further down.
  let settings: Awaited<ReturnType<typeof loadChatbotConfig>>["settings"] = null
  let system_prompt: string | null = null
  let knowledge: string | null = null
  try {
    const [{ settings: loadedSettings, system_prompt: loadedPrompt }, loadedKnowledge] =
      await Promise.all([loadChatbotConfig(), loadKnowledgeBase()])
    settings = loadedSettings
    system_prompt = loadedPrompt
    knowledge = loadedKnowledge
  } catch (err) {
    console.error("[webhook/facebook] chatbot config load failed:", err)
  }

  // Response Language applies to the deterministic replies too, not just the
  // model's free text — those used to be hardcoded English regardless.
  const lang = settings?.language as BotLanguage | undefined

  // Every deterministic, fixed-copy reply this turn uses this instead of raw
  // `lang` — "both" used to mean "show English AND Filipino, concatenated,
  // every time" for these, which read as a wall of duplicated text to a
  // customer clearly writing in only one language. Resolved the same way the
  // quick-reply buttons already are: detect the customer's own last message
  // and pick just that language. `lang` itself is left untouched for the
  // Gemini system prompt, which keeps its own per-turn detect-and-match
  // instruction for the AI's free-text replies.
  const effectiveLang: BotLanguage | undefined = lang === "both" ? detectMessageLanguage(messageBody) : lang

  // Admin-editable Message Templates, each resolved against its built-in
  // default once per turn and reused at every send site below.
  const vehicleStatusTemplate = resolveTemplate(
    settings?.vehicle_status_message_en, settings?.vehicle_status_message_fil,
    DEFAULT_VEHICLE_STATUS_MESSAGE_EN, DEFAULT_VEHICLE_STATUS_MESSAGE_FIL,
  )
  const linkVerificationTemplate = resolveTemplate(
    settings?.link_verification_message_en, settings?.link_verification_message_fil,
    DEFAULT_LINK_VERIFICATION_MESSAGE_EN, DEFAULT_LINK_VERIFICATION_MESSAGE_FIL,
  )
  const escalationTemplate = resolveTemplate(
    settings?.escalation_message_en, settings?.escalation_message_fil,
    DEFAULT_ESCALATION_MESSAGE_EN, DEFAULT_ESCALATION_MESSAGE_FIL,
  )
  const bookingTemplate = resolveTemplate(
    settings?.booking_message_en, settings?.booking_message_fil,
    DEFAULT_BOOKING_MESSAGE_EN, DEFAULT_BOOKING_MESSAGE_FIL,
  )

  // ── First Time Message ────────────────────────────────────────────────────
  // Sent once, on a person's very first message to the page, before the AI
  // answers that same message (the flow below continues unchanged). Never
  // blocks the reply: a failed send is logged and the AI still responds.
  let welcomeSent = false
  if (shouldSendFirstTimeMessage({ isNewConversation: is_new_conversation, aiEnabled: settings?.enable_ai_chatbot !== false })) {
    try {
      const firstTime = resolveTemplate(
        settings?.first_time_message_en, settings?.first_time_message_fil,
        DEFAULT_FIRST_TIME_MESSAGE_EN, DEFAULT_FIRST_TIME_MESSAGE_FIL,
      )
      const welcomeLang = effectiveLang === "filipino" ? "filipino" : "english"
      const welcome = renderFirstTimeMessage(
        pickCopy(effectiveLang, firstTime.en, firstTime.fil),
        profile.name,
        welcomeLang,
      )
      const welcomeId = await sendMessengerText(senderId, welcome)
      await insertMessage({
        conversation_id,
        sender_type: "agent",
        message_body: welcome,
        sent_at: new Date().toISOString(),
        fb_message_id: welcomeId,
      })
      welcomeSent = true
    } catch (err) {
      console.error("[webhook/facebook] first-time message failed:", err)
    }
  }

  // ── Master switch: AI chatbot disabled ───────────────────────────────────
  // Send the configured acknowledgement once, hand the thread to Sales, and
  // stop. Everything downstream (link verification, status lookups, the booking
  // state machine, both Gemini calls, quick replies) is skipped.
  if (settings && settings.enable_ai_chatbot === false) {
    await handOffWhileDisabled(admin, {
      conversation_id,
      senderId,
      psidName: profile.name,
      messageBody,
      timestamp,
      message: settings.ai_disabled_message?.trim() || DEFAULT_AI_DISABLED_MESSAGE,
    })
    return
  }

  const quickReplyPayload = msg.quick_reply?.payload ?? null

  // Rate-limits predefined quick-reply buttons (Vehicle Status, Booking,
  // Report, ...): a rapid repeat tap of the SAME button within this window is
  // recorded (insertMessage above) but not answered again. Anchored to
  // `last_message_at`, which getOrCreateConversationByPsid updates
  // synchronously at the very top of every call — before any slow AI/DB
  // work — so a burst of taps is always measured against the immediately
  // preceding one, not a stale first-tap timestamp.
  const QUICK_REPLY_COOLDOWN_MS = 3000
  const isRepeatQuickReplyTap =
    Boolean(quickReplyPayload) &&
    quickReplyPayload === last_quick_reply_payload &&
    Boolean(last_message_at) &&
    new Date(timestamp).getTime() - new Date(last_message_at as string).getTime() < QUICK_REPLY_COOLDOWN_MS

  // Always persisted (including `null` for a typed message) so an unrelated
  // reply in between two taps of the same button correctly resets the
  // comparison instead of leaving a stale payload to match against later.
  await safe(() => setLastQuickReplyPayload(conversation_id, quickReplyPayload))

  if (isRepeatQuickReplyTap) return

  // Resolved before the link-verification block below, which needs them to tell a
  // deliberate subject change ("I want to book", "let me talk to someone") from a
  // failed attempt at sending a plate + phone.
  const humanRequested = requestedHuman(messageBody)
  // `let` — a message classified as a complaint (see the violation handling
  // further down) sets this true so the existing reportIntent-driven
  // escalation-type/ack logic further down picks "Report" up for free.
  let reportIntent =
    quickReplyPayload === "report" ||
    REPORT_PATTERNS.some((re) => re.test(messageBody))

  // ── Account-linking verification ─────────────────────────────────────────
  // When the bot has asked an unlinked customer for their Job Order ID, the
  // next message is a link CLAIM. Handled BEFORE any booking-signal logic so a
  // code reply is not swallowed by the booking flow.
  //
  // Unlike the old plate+phone flow, a code that resolves to an UNLINKED
  // record is linked immediately by the bot — see assessJobOrderLinkClaim for
  // why that's safe here. Only a genuine conflict (the code's record already
  // belongs to a different Messenger account) or a code that never resolves
  // goes to Sales, and only after the customer insists past a short retry cap.
  //
  // A code can also be claimed OPPORTUNISTICALLY, outside this "awaiting" flow
  // — see the block right after this one — for a customer whose account is
  // already linked to a job-less record (e.g. a repeat customer between jobs).
  // `clearLink`, `countFailedAttempt`, and `tryClaimJobOrderCode` below are
  // declared here (not nested inside the `if`) so both trigger sites share the
  // exact same verification logic.
  const JOB_ORDER_LINK_ATTEMPT_CAP = 2
  let linkedVehicleContext: string | null = null
  // Deterministic customer-facing status text for a JUST-auto-linked account —
  // see the `statusReply` short-circuit further down. Without this, a freshly
  // linked account's status was handed to Gemini as free-form context instead
  // of sent verbatim, and the model was observed inventing an "I still cannot
  // verify the Job Order Code" refusal even though the link had already
  // succeeded and been audit-logged.
  let linkedStatusReply: string | null = null
  // A plain object property (not a bare `let`) — TS's flow-narrowing for a `let`
  // reassigned only inside nested closures (tryClaimJobOrderCode / countFailedAttempt
  // below) loses track of those writes across the several call sites further down,
  // narrowing later reads to `never`. A mutable object sidesteps that.
  const linkState: { escalation: { reason: string; note: string | null; impersonation?: boolean } | null } = { escalation: null }

  const clearLink = async () => {
    await safe(() => setAwaitingLinkVerification(conversation_id, false))
    await safe(() => setLinkAttempts(conversation_id, 0))
    await safe(() => setLinkConflictPending(conversation_id, false))
  }

  // Sales-facing note for a claim on a record owned by another Messenger
  // account. Nothing here is ever shown to the customer.
  const impersonationEscalation = (code: string, attempt: "repeat" | "capped") => ({
    impersonation: true,
    reason: "possible impersonation — link attempt on a record owned by another Messenger account",
    note:
      `POSSIBLE IMPERSONATION. Messenger PSID ${senderId} (FB name "${profile.name}") tried to claim Job Order ID ${code}, ` +
      `which is already linked to a different Messenger account. ` +
      (attempt === "repeat"
        ? "They were given a neutral re-ask and claimed it again. "
        : "They hit the attempt cap while claiming it. ") +
      "Do NOT re-link without confirming with the current owner.",
  })

  // One more failed link attempt. Under the attempt cap the customer is asked
  // again (deterministically — the model must never own this turn, or it
  // invents a lookup it never ran); at the cap the claim goes to Sales.
  const countFailedAttempt = async (note: string, code: string | null): Promise<boolean> => {
    const attempts = link_attempts + 1
    if (attempts >= JOB_ORDER_LINK_ATTEMPT_CAP) {
      await clearLink()
      logAudit({ ...auditActor, category: "flag", action: `messenger: link verification failed ${JOB_ORDER_LINK_ATTEMPT_CAP}x`, target: `psid=${senderId} last_code=${code || "none"}` })
      linkState.escalation = { reason: `account link — ${JOB_ORDER_LINK_ATTEMPT_CAP} unverified attempts`, note }
      return false
    }
    await safe(() => setLinkAttempts(conversation_id, attempts))
    const askAgain = buildLinkVerificationPrompt({ retry: "unrecognized", lang: effectiveLang, linkVerificationTemplate })
    const mid = await sendMessengerText(senderId, askAgain)
    await insertMessage({ conversation_id, sender_type: "agent", message_body: askAgain, sent_at: new Date().toISOString(), fb_message_id: mid })
    return true
  }

  // Verifies a Job Order Code claim, shared by the "awaiting" flow below and
  // the opportunistic trigger after it. Returns "handled" when a reply was
  // already sent this turn and the caller must return immediately; "continue"
  // otherwise (linkedVehicleContext or linkEscalation is set as a side effect
  // and the normal turn keeps processing).
  const tryClaimJobOrderCode = async (code: string): Promise<"handled" | "continue"> => {
    const claim = await assessJobOrderLinkClaim({ psid: senderId, code })

    if (claim.kind === "owned_by_requester") {
      // Defensive — resolveOwnVehicleStatus should already have found this.
      await clearLink()
      linkedVehicleContext = formatOwnVehicleStatus(claim.outcome)
      linkedStatusReply = formatVehicleStatusForCustomer(claim.outcome, { vehicleStatusTemplate, lang: effectiveLang })
      return "continue"
    } else if (claim.kind === "linked") {
      // Auto-linked just now — no Sales step. Show status this same turn.
      await clearLink()
      logAudit({ ...auditActor, category: "flag", action: "messenger: auto-linked account via Job Order ID", target: `psid=${senderId} code=${code}` })
      linkedVehicleContext = formatOwnVehicleStatus(claim.outcome)
      linkedStatusReply = formatVehicleStatusForCustomer(claim.outcome, { vehicleStatusTemplate, lang: effectiveLang })
      return "continue"
    } else if (claim.kind === "owned_by_other") {
      // The code belongs to a DIFFERENT Messenger account. The customer is
      // never told that — a reply that differed from the "no such record"
      // case would let anyone enumerate which codes are registered. They get
      // the identical neutral re-ask once; a second claim is escalated.
      //
      // The first attempt is audit-logged even though nothing is escalated,
      // so a probe that stops after one try still leaves a security trail.
      logAudit({ ...auditActor, category: "flag", action: `messenger: link attempt on a record owned by another account (${link_conflict_pending ? "repeat — escalated" : "first — warned"})`, target: `psid=${senderId} code=${code}` })

      if (link_conflict_pending) {
        await clearLink()
        linkState.escalation = impersonationEscalation(code, "repeat")
        return "continue"
      } else if (link_attempts + 1 >= JOB_ORDER_LINK_ATTEMPT_CAP) {
        // Already at the attempt cap — no room for a warning turn.
        await clearLink()
        linkState.escalation = impersonationEscalation(code, "capped")
        return "continue"
      } else {
        await safe(() => setLinkConflictPending(conversation_id, true))
        await safe(() => setLinkAttempts(conversation_id, link_attempts + 1))
        const askAgain = buildLinkVerificationPrompt({ retry: "conflict", lang: effectiveLang, linkVerificationTemplate })
        const mid = await sendMessengerText(senderId, askAgain)
        await insertMessage({ conversation_id, sender_type: "agent", message_body: askAgain, sent_at: new Date().toISOString(), fb_message_id: mid })
        return "handled"
      }
    } else {
      // no_record — let the customer self-correct, then escalate. Same
      // message as the owned-by-another case above, deliberately.
      const handled = await countFailedAttempt(
        `Account link attempt failed verification ${JOB_ORDER_LINK_ATTEMPT_CAP} times. Last claim: Job Order ID ${code}, no matching linkable record.`,
        code
      )
      return handled ? "handled" : "continue"
    }
  }

  if (awaiting_link_verification) {
    const code = extractJobOrderCode(messageBody)

    // A different, clear intent means the customer deliberately changed the
    // subject — let them out of the linking step rather than looping the ask.
    const changedSubject =
      Boolean(quickReplyPayload) ||
      humanRequested ||
      reportIntent ||
      hasBookingIntent(messageBody) ||
      hasExistingBookingIntent(messageBody)

    if (!code) {
      if (changedSubject) {
        // The customer wandered off the linking step on purpose. Reset fully
        // (not just the "awaiting" flag) so a later, genuinely fresh attempt
        // doesn't inherit a stale attempt count and hit the cap prematurely.
        await clearLink()
      } else if (isLowContentAck(messageBody)) {
        // A filler/acknowledgment reply to the bot's own previous message
        // ("ano po?", "ok", "noted") — not a real attempt at a code. Re-ask
        // without spending one of the customer's two retries; deterministic,
        // same as countFailedAttempt's own re-ask, for the same reason (the
        // model must never own this turn).
        const askAgain = buildLinkVerificationPrompt({ retry: "unrecognized", lang: effectiveLang, linkVerificationTemplate })
        const mid = await sendMessengerText(senderId, askAgain)
        await insertMessage({ conversation_id, sender_type: "agent", message_body: askAgain, sent_at: new Date().toISOString(), fb_message_id: mid })
        return
      } else {
        // Still trying to link, but the message carries no readable Job Order
        // Code. Re-ask with a format example instead of dropping them into the
        // AI, which would answer as though a lookup had happened.
        const handled = await countFailedAttempt(
          `Account link attempt failed ${JOB_ORDER_LINK_ATTEMPT_CAP} times. The customer never sent a recognizable Job Order ID. ` +
          `Last message: "${messageBody}".`,
          null
        )
        if (handled) return
      }
    } else {
      const result = await tryClaimJobOrderCode(code)
      if (result === "handled") return
    }
  } else if (!linkedVehicleContext && !linkState.escalation) {
    // Opportunistic claim: the bot never asked for a code this turn, but the
    // customer sent one anyway. This is the path for a customer whose account
    // is already linked to a job-less record (a repeat customer between jobs,
    // or a duplicate customer_record from a manual Operations entry) — the
    // "awaiting" flow above is never entered for them since resolveOwnVehicleStatus
    // doesn't return "not_linked" in that case, so without this they'd never
    // get a chance to link a new job order's code at all.
    const opportunisticCode = extractJobOrderCode(messageBody)
    if (opportunisticCode) {
      let currentOutcome: OwnVehicleOutcome | null = null
      try {
        currentOutcome = await resolveOwnVehicleStatus(senderId)
      } catch (err) {
        console.error("[webhook/facebook] opportunistic status resolution failed:", err)
      }
      const jobless = currentOutcome !== null && (
        (currentOutcome.kind === "ok" && currentOutcome.jobs.length === 0) ||
        currentOutcome.kind === "booked_no_active_job"
      )
      if (jobless) {
        const result = await tryClaimJobOrderCode(opportunisticCode)
        if (result === "handled") return
      }
    }
  }

  // Intent detection. Status intent always wins over booking intent: a status
  // lookup is read-only and non-destructive, so checking it first is safe.
  const bookingIntent =
    quickReplyPayload === "booking" || hasBookingIntent(messageBody)
  // While a booking flow is engaged, ambiguous status keywords ("check",
  // "update", "progress") must NOT flip the conversation into a status lookup —
  // that would clear is_booking_flow and drop the confirmation guardrail. Only an
  // explicit "Vehicle Status" quick-reply switches the customer out mid-booking.
  //
  // `is_vehicle_inquiry` alone is NOT enough to re-enter the status flow — it
  // also requires `continuesStatusInquiry` (a plate number in this message).
  // Otherwise ANY later message ("thank you", small talk, a new question) would
  // count as a status continuation, since the flag was never cleared once set —
  // that bug re-sent the exact same status reply after every single message the
  // customer sent afterward, including a plain "thanks".
  const statusIntent =
    quickReplyPayload === "status" ||
    ((hasStatusIntent(messageBody) ||
      (!bookingIntent && is_vehicle_inquiry && continuesStatusInquiry(messageBody))) &&
      !is_booking_flow &&
      !awaiting_confirmation)

  // ── Cancel / abort of the booking being collected right now ──────────────
  // Distinct from an existing-booking operation. "cancel my booking" is
  // ambiguous, so it only counts as an abort when a draft is actually in
  // progress AND the customer has no live job order; otherwise it stays a
  // Sales escalation. Plain abandonment ("nevermind", "wag na") never refers to
  // a job on file, so it aborts without the lookup.
  const rawExistingBookingIntent = hasExistingBookingIntent(messageBody)
  const draftInProgress =
    is_booking_flow ||
    awaiting_confirmation ||
    Boolean(
      booking_draft &&
        (booking_draft.full_name || booking_draft.contact_number ||
         booking_draft.plate_number || booking_draft.vehicle_unit || booking_draft.email)
    )

  let cancelIntent = false
  if (draftInProgress) {
    if (hasCancelIntent(messageBody)) {
      cancelIntent = true
    } else if (rawExistingBookingIntent) {
      try {
        const active = await lookupActiveBooking(senderId)
        cancelIntent = !active.hasActiveBooking
      } catch (err) {
        console.error("[webhook/facebook] active booking lookup failed:", err)
      }
    }
  }

  // An existing-booking operation (change/cancel/modify/reschedule) is never a
  // new booking — it is escalated to Sales for handling. Suppressed when the
  // customer is really aborting the draft in progress, which must NOT escalate.
  const existingBookingIntent = rawExistingBookingIntent && !cancelIntent

  // A message carries a booking signal when it states booking intent or
  // contains a booking detail token (plate / phone / email).
  const signal = bookingSignal(messageBody)

  // Persist which flow the conversation is in so a bare follow-up reply
  // (e.g. just a plate + phone after the status template, or a vehicle type
  // that completes a booking) stays on the same track without needing the
  // keyword repeated.
  if (!awaiting_link_verification && !linkState.escalation) {
    try {
      if (cancelIntent) {
        await setVehicleInquiry(conversation_id, false)
        await setBookingFlow(conversation_id, false)
      } else if (statusIntent) {
        await setVehicleInquiry(conversation_id, true)
        await setBookingFlow(conversation_id, false)
      } else if (existingBookingIntent) {
        await setVehicleInquiry(conversation_id, false)
        await setBookingFlow(conversation_id, false)
      } else if (bookingIntent || signal) {
        await setVehicleInquiry(conversation_id, false)
        await setBookingFlow(conversation_id, true)
      } else if (is_booking_flow && !awaiting_confirmation) {
        // The customer moved on to something else mid-booking and there is no
        // confirmation pending. Clear the flag now — it used to be sticky with
        // nothing to clear it, so unrelated questions ("October promo") were
        // pulled into the booking block and answered with booking context
        // appended. Mirrors the is_vehicle_inquiry self-clear below.
        await setBookingFlow(conversation_id, false)
      } else if (is_vehicle_inquiry) {
        // The status topic was answered and this message carries no
        // continuation signal (see `continuesStatusInquiry` above) — the
        // customer has moved on. Clear the flag now rather than leaving it to
        // linger indefinitely; nothing else ever clears it on its own.
        await setVehicleInquiry(conversation_id, false)
      }
    } catch (err) {
      console.error("[webhook/facebook] flow persistence failed:", err)
    }
  }

  // Vehicle-status context. Identity is resolved STRICTLY from the sender's psid:
  //   psid → customer_record → verified phone → all active job_orders
  // A plate in the message only narrows to one of the customer's OWN vehicles,
  // or (if it is nobody's of theirs) triggers a refusal — never a data lookup.
  const plateInMsg = normalizePlate(messageBody.match(PLATE_PATTERN)?.[0] ?? "")
  let vehicleContext: string | null = null
  // Deterministic customer-facing status reply. When set, it is sent verbatim
  // and the Gemini call is skipped — the model kept ignoring the resolved status
  // and sending the "provide your details" template instead.
  let statusReply: string | null = null

  if (linkedVehicleContext) {
    vehicleContext = linkedVehicleContext
    // Same reasoning as the deterministic `statusReply` comment above — a
    // customer whose account was JUST auto-linked this turn must get their
    // status relayed verbatim, not handed to the model to compose.
    statusReply = linkedStatusReply
  } else if (statusIntent && !bookingIntent && !linkState.escalation) {
    let outcome: OwnVehicleOutcome
    try {
      outcome = await resolveOwnVehicleStatus(senderId)
    } catch (err) {
      console.error("[webhook/facebook] vehicle status resolution failed:", err)
      outcome = { kind: "not_linked" }
    }
    const jobPlates = outcome.kind === "ok" ? outcome.jobs.map((j) => normalizePlate(j.plate)) : []
    const focusPlate = plateInMsg && jobPlates.includes(plateInMsg) ? plateInMsg : undefined
    const plateMismatch =
      Boolean(plateInMsg) && !focusPlate && outcome.kind === "ok" && jobPlates.length > 0

    if (plateMismatch) {
      vehicleContext = formatOwnVehicleStatus(outcome, { plateMismatch: true })
      logAudit({ ...auditActor, category: "flag", action: "messenger status: plate not owned by requester", target: `psid=${senderId} requested_plate=${plateInMsg} account_plates=${jobPlates.join("/") || "none"}` })
    } else {
      vehicleContext = formatOwnVehicleStatus(outcome, { focusPlate })
      statusReply = formatVehicleStatusForCustomer(outcome, {
        focusPlate,
        vehicleStatusTemplate,
        lang: effectiveLang,
      })
      if (outcome.kind === "ok" && outcome.soft) {
        logAudit({ ...auditActor, category: "flag", action: "messenger status: soft-matched via own inquiry", target: `psid=${senderId} jobs=${jobPlates.join("/") || "none"}` })
      }
      if (outcome.kind === "booked_no_active_job") {
        logAudit({ ...auditActor, category: "flag", action: "messenger status: booking on file, no active job", target: `psid=${senderId} plate=${outcome.plate ?? "?"}` })
      }
      if (outcome.kind === "not_linked") {
        logAudit({ ...auditActor, category: "flag", action: "messenger status: no linked customer record", target: `psid=${senderId}${plateInMsg ? ` requested_plate=${plateInMsg}` : ""}` })
        // Ask for the Job Order ID so the next message can link the account.
        await safe(() => setAwaitingLinkVerification(conversation_id, true))
      }
    }
  }

  // AI auto-reply + escalation decision. `humanRequested` / `reportIntent` are
  // resolved earlier — the link-verification block needs them.
  let reply: string | null = statusReply
  let escalate = humanRequested || reportIntent || existingBookingIntent
  // Customer-safe reason surfaced in the escalation ack (escalationAck below).
  // existingBookingIntent deliberately maps to null — it already gets its own
  // dedicated pre-message via existingBookingHandoff, so a reason clause here
  // would be redundant. Some internal reasons (impersonation, identity
  // conflict, the model's own unvetted text) must NEVER be set here — see
  // EscalationReason's doc comment in lib/messenger/copy.ts.
  let escalateReason: EscalationReason | null = humanRequested
    ? "human_requested"
    : reportIntent
      ? "report"
      : null
  let aiReason: string | null = null
  let aiViolation: "none" | "off_topic" | "policy" | "complaint" = "none"
  let extracted: ChatbotReply["customer"] = null
  // Recorded on the inquiry when a booking / violation escalation needs a
  // Sales note (identity conflict, repeat in-service booking, an immediate
  // threat/policy escalation, repeated violations…). Declared here (not just
  // before the graduated-ladder block below) so the policy-violation branch
  // in the try block can set it too.
  let conflictNote: string | null = null

  try {
    // A deterministic status answer owns the reply — skip Gemini entirely.
    const result = statusReply
      ? { reply: statusReply, escalate: false, reason: null, violation: "none" as const, customer: null }
      : await generateChatbotReply({
          message: messageBody,
          history,
          settings,
          system_prompt,
          knowledge,
          vehicleContext,
          welcomeSent,
        })

    reply = result.reply?.trim() || null
    // The model's own escalate flag is the "question the AI cannot answer" trigger.
    const modelEscalate = result.escalate
    escalate = modelEscalate || humanRequested || reportIntent || existingBookingIntent
    // The model's own `result.reason` is unvetted free-text — never surfaced
    // to the customer (see the doc comment above).
    escalateReason = humanRequested
      ? "human_requested"
      : reportIntent
        ? "report"
        : null
    aiReason = result.reason ?? null
    aiViolation = result.violation ?? "none"
    extracted = result.customer ?? null

    // These classifications are decided ENTIRELY here, in code — not by the
    // model's separate `escalate` flag, which is unreliable for exactly these
    // high-stakes cases (a threat, a strongly-worded complaint) despite being
    // told not to escalate them itself. `escalate` is force-set here
    // regardless of what the model set it to, unless a deterministic signal
    // independently warrants escalating anyway (an explicit human request,
    // explicit report wording, or an existing-booking operation).
    const violationHandled = !humanRequested && !reportIntent && !existingBookingIntent
    if (aiViolation === "complaint" && violationHandled) {
      if (complaint_streak < 1) {
        // First complaint signal this conversation — clarify instead of an
        // instant full mute (an ambiguous/mildly-worded message is easy for
        // the model to misread). A direct "Report a Concern" tap or report
        // keyword bypasses this branch entirely (violationHandled is false
        // then) and still escalates immediately, so a customer who does want
        // a human right away isn't slowed down.
        escalate = false
        escalateReason = null
        reply = complaintClarify(effectiveLang)
        complaintStreakNext = 1
        await safe(() => setViolationStreaks(conversation_id, offtopic_streak, policy_streak, complaintStreakNext))
      } else {
        // Second consecutive complaint-classified message — a real concern,
        // escalate immediately, filed as a Report rather than a generic Human
        // Response. Reusing `reportIntent` (already a `let`) gets that
        // routing and the "report" ack for free from the existing logic just
        // above and the inquiry_type resolution further down.
        escalate = true
        reportIntent = true
        escalateReason = "report"
      }
    } else if (aiViolation === "policy" && violationHandled) {
      // A threat, jailbreak attempt, or abusive/harassing message is also a
      // real concern — escalate immediately rather than warning first. The
      // conflict note flags exactly why, since this can include an actual
      // threat that needs careful handling, not just a repeated nuisance.
      escalate = true
      escalateReason = "violation"
      conflictNote = `Auto-escalated: message classified as a possible threat or policy violation. Last message: "${messageBody}".`
    } else if (aiViolation === "off_topic" && violationHandled) {
      // Genuinely benign — the graduated warning ladder below decides if/when
      // this escalates, never on the first occurrence. Reply text is
      // reviewed, deterministic copy rather than the model's own
      // composition: relying on it to translate a fixed sentence live for
      // "filipino"/"both" is unreliable at best.
      escalate = false
      escalateReason = null
      reply = offTopicRedirect(effectiveLang)
    }

    // Option B safety net: If we're in a vehicle status flow and the lookup
    // returned real status data (not just a "must be verified" prompt), the AI
    // should never escalate. The status data is already in the prompt — the AI
    // just needs to relay it. This guards against AI confusion from conflicting
    // escalation rules in the system prompt.
    if (
      statusIntent &&
      vehicleContext &&
      !vehicleContext.includes("must be verified") &&
      !vehicleContext.includes("Please provide")
    ) {
      escalate = false
      escalateReason = null
    }
  } catch (err) {
    // If the AI fails, err on the side of escalating to a human.
    console.error("[webhook/facebook] chatbot error:", err)
    escalate = true
    escalateReason = "hiccup"
  }

  // ── Graduated off-topic / policy-violation escalation ────────────────────
  // Count consecutive violation turns. Off-topic escalates after 5 (warned on
  // 4); safety/policy escalates after 2 (warned on 1). The streak resets on any
  // valid on-topic message. Skipped when the current message carries a
  // deterministic on-topic signal, so a real booking/status line misclassified
  // by the model cannot accrue a strike.
  let violationWarning: string | null = null
  const onTopicSignal =
    bookingIntent || statusIntent || existingBookingIntent ||
    Boolean(quickReplyPayload) || signal || isPureConfirmation(messageBody)
  if (
    !escalate && !humanRequested && !reportIntent && !existingBookingIntent &&
    !onTopicSignal
  ) {
    const vs = nextViolationState(
      { offtopic: offtopic_streak, policy: policy_streak },
      // "complaint" and "policy" both escalate immediately above and never
      // reach here with `escalate` still false — this mapping is purely for
      // TypeScript; a "complaint" classification is not part of the
      // off-topic/policy streak ladder and must not affect it.
      aiViolation === "complaint" ? "none" : aiViolation
    )
    // Pass the tracked complaint streak through unchanged — this ladder call
    // has nothing to do with it (it's set directly, above, when a complaint
    // classification actually fires this turn); using complaintStreakNext
    // (not the stale complaint_streak read at the top of the request) avoids
    // clobbering a fresh same-turn write back to its old value.
    await safe(() => setViolationStreaks(conversation_id, vs.offtopic, vs.policy, complaintStreakNext))
    // Repeated off-topic/policy messages are the other "AI cannot help here"
    // case. The warnings still fire either way — they keep the conversation on
    // track without involving staff.
    if (vs.action === "escalate") {
      escalate = true
      const isPolicy = vs.policy >= 2
      escalateReason = "violation"
      conflictNote =
        `Auto-escalated after repeated ${isPolicy ? "policy-violating" : "off-topic"} messages. ` +
        `Last message: "${messageBody}".`
    } else if (vs.action === "warn") {
      violationWarning = violationWarningCopy(vs.policy >= 1 ? "policy" : "offtopic", effectiveLang)
    }
  }

  // Booking flow: deterministic remind → confirm → escalate. This overrides the
  // AI's own escalate flag so a completed booking is never finalized before the
  // customer confirms their details, and missing fields are called out.
  //
  // The flow fires when the CURRENT message carries a booking signal
  // (booking intent / a detail token), the conversation is flagged as being in
  // a booking flow (is_booking_flow was persisted by an earlier turn), OR the
  // customer is still on the confirmation step (awaiting_confirmation was
  // persisted by a previous turn). Persisting is_booking_flow keeps the flow
  // engaged across detail-collection turns whose final detail (e.g. a vehicle
  // type like "Ford") carries no booking signal of its own.
  //
  // Option A fix: A bare plate in a status follow-up must NOT trigger bookingFlow.
  // When statusIntent is true (vehicle status request), the plate is part of the
  // status lookup, not a booking detail token.
  //
  // See shouldStayInBookingFlow for the two behaviours this decision gained:
  // a cancelled/aborted booking exits immediately, and a sticky is_booking_flow
  // no longer drags unrelated messages in on its own.
  const bookingFlow = shouldStayInBookingFlow({
    signal,
    statusIntent,
    awaitingLinkVerification: Boolean(awaiting_link_verification),
    linkEscalation: Boolean(linkState.escalation),
    isBookingFlow: Boolean(is_booking_flow),
    awaitingConfirmation: Boolean(awaiting_confirmation),
    cancelIntent,
  })
  let escalateBooking = false

  // ── Booking aborted by the customer ──────────────────────────────────────
  // Answered deterministically and terminally: the draft and every flow flag
  // are cleared, and nothing is escalated. Deliberately NOT handed to Gemini —
  // with the booking still in conversation history the model re-offered the
  // booking it had just been told to drop.
  if (cancelIntent) {
    await safe(() => setBookingFlow(conversation_id, false))
    await safe(() => setAwaitingConfirmation(conversation_id, false))
    await safe(() => setConflictPending(conversation_id, false))
    await safe(() => setActiveBookingOffered(conversation_id, false))
    await safe(() => setBookingDuplicateNotified(conversation_id, false))
    await safe(() => setBookingDraft(conversation_id, null))

    const cancelReply = buildBookingCancelledMessage(effectiveLang)
    const mid = await sendMessengerText(senderId, cancelReply)
    await insertMessage({
      conversation_id,
      sender_type: "bot",
      message_body: cancelReply,
      sent_at: new Date().toISOString(),
      fb_message_id: mid,
    })
    await sendMessengerQuickReply(senderId, "Anything else?", quickRepliesFor(effectiveLang))
    return
  }

  // Every account-link claim is routed to Sales for out-of-band verification.
  const linkEscalationInfo = linkState.escalation
  if (linkEscalationInfo) {
    escalate = true
    // A conflict flagged as possible impersonation must never be surfaced to
    // the customer — only a genuinely unrecognized code is safe to mention.
    escalateReason = linkEscalationInfo.impersonation ? null : "job_order_unrecognized"
    if (linkEscalationInfo.note) conflictNote = linkEscalationInfo.note
  }

  // Best-effort flag persistence: a failure here should not abort the reply.
  const persistConfirmFlag = async (value: boolean) => {
    try {
      await setAwaitingConfirmation(conversation_id, value)
    } catch (err) {
      console.error("[webhook/facebook] setAwaitingConfirmation failed:", err)
    }
  }
  const persistBookingFlowFlag = async (value: boolean) => {
    try {
      await setBookingFlow(conversation_id, value)
    } catch (err) {
      console.error("[webhook/facebook] setBookingFlow failed:", err)
    }
  }
  const persistActiveBookingOffered = async (value: boolean) => {
    try {
      await setActiveBookingOffered(conversation_id, value)
    } catch (err) {
      console.error("[webhook/facebook] setActiveBookingOffered failed:", err)
    }
  }
  const persistConflictPending = async (value: boolean) => {
    try {
      await setConflictPending(conversation_id, value)
    } catch (err) {
      console.error("[webhook/facebook] setConflictPending failed:", err)
    }
  }
  const persistBookingDuplicateNotified = async (value: boolean) => {
    try {
      await setBookingDuplicateNotified(conversation_id, value)
    } catch (err) {
      console.error("[webhook/facebook] setBookingDuplicateNotified failed:", err)
    }
  }

  // Local flag: a vehicle-in-service notice owns the reply this turn; the rest
  // of the booking block is skipped (same idea as `acknowledgeDuplicate`).
  let vehicleInServiceHandled = false
  // Set when the booking flow itself decides to hand the customer to a human
  // (re-booking an in-service vehicle after being told; stuck on missing
  // details). Lets the escalation survive the `!escalateBooking` guard below.
  let forceHumanEscalation = false

  if (bookingFlow && !statusIntent && !humanRequested && !reportIntent && !existingBookingIntent) {
    // ── Vehicle already in service — cannot be re-booked ───────────────────
    // Checked before any collect/forward branch. If the plate the customer is
    // booking has ANY live job order, the bot refuses; a repeat push for the
    // same plate (a prior in-service notice for it is in history) escalates.
    const plateCandidate =
      extracted?.plate_number ||
      (messageBody.match(PLATE_PATTERN)?.[0] ?? "") ||
      booking_draft.plate_number ||
      ""
    if (plateCandidate) {
      const inSvc = await lookupActiveJobByPlate(plateCandidate)
      if (inSvc.inService) {
        const normPlate = normalizePlate(plateCandidate)
        const plateStripped = normPlate.replace(/[^A-Z0-9]/g, "")
        const alreadyTold = history.some(
          (h) =>
            h.role === "model" &&
            /currently in service/i.test(h.text) &&
            h.text.toUpperCase().replace(/[^A-Z0-9]/g, "").includes(plateStripped)
        )
        if (alreadyTold) {
          escalate = true
          escalateBooking = false
          forceHumanEscalation = true
          escalateReason = "vehicle_in_service"
          conflictNote =
            `Re-booking plate ${normPlate}, currently in service (job status ${inSvc.status ?? "?"}). ` +
            "Customer was already informed once and is still pushing to book it."
        } else {
          escalate = false
          escalateBooking = false
          reply = buildVehicleInServiceNotice(normPlate, inSvc)
          vehicleInServiceHandled = true
          await persistConfirmFlag(false)
          await persistConflictPending(false)
          await persistActiveBookingOffered(false)
          await persistBookingFlowFlag(false)
          await safe(() => setBookingDraft(conversation_id, null))
          // If the customer pushes again with the SAME plate, the history scan
          // above ("currently in service" + plate) escalates to a human.
        }
      }
    }
  }

  if (
    bookingFlow && !vehicleInServiceHandled && !escalate &&
    !statusIntent && !humanRequested && !reportIntent && !existingBookingIntent
  ) {
    // Merge this turn's extraction onto the draft collected so far. A Gemini
    // pass that omits a field (common on a bare "yes") can no longer regress the
    // flow — a detail once given stays until the customer changes it.
    extracted = mergeBookingDetails(booking_draft, extracted)

    // Gemini (lite model) often omits phone/email/plate even from a clean
    // comma-separated list — take them straight from the customer's text; a
    // literal match beats a guess and overrides a mis-read value.
    extracted = mergeBookingDetails(extracted, extractDetailTokens(messageBody))
    let missing = missingBookingFields(extracted)

    // Refresh the extraction with a focused second pass before deciding the
    // booking is incomplete — the first reply pass sometimes drops a detail
    // that is plainly in the (now most-recent) history.
    if (missing.length > 0) {
      try {
        const refreshed = await extractCustomerDetails({
          message: messageBody,
          history,
          settings,
          system_prompt,
          knowledge,
        })
        if (hasExtractedDetails(refreshed)) {
          extracted = mergeBookingDetails(extracted, refreshed)
          missing = missingBookingFields(extracted)
        }
      } catch (err) {
        console.error("[webhook/facebook] booking-flow extraction refresh failed:", err)
      }
    }

    // Persist the merged draft so the next turn resumes from it, even if that
    // turn's own extraction comes back partial. Cleared on every terminal path.
    await safe(() => setBookingDraft(conversation_id, extracted))

    // A returning customer (same psid) who already has an ACTIVE booking (a live
    // job) is briefly informed their booking is currently active, but the new
    // booking request is still collected and submitted to Sales normally. The
    // notice is shown once per booking attempt (active_booking_offered). A
    // customer_record alone does not count as an active booking
    const activeBooking = await lookupActiveBooking(senderId)

    // Dedup: an identical repeat booking for a vehicle this psid is already on
    // file for (i.e. a previously recorded/resolved booking) is acknowledged
    // once WITHOUT creating another inquiry. If the customer submits the same
    // booking yet again after being told, it is escalated to Sales, flagged as a
    // repeat via conflict_note.
    const sameVehicleOnFile =
      missing.length === 0 && isSameVehicleOnFile(activeBooking.record, extracted)
    const acknowledgeDuplicate = sameVehicleOnFile && !booking_duplicate_notified

    if (acknowledgeDuplicate) {
      escalate = false
      escalateBooking = false
      reply = buildDuplicateBookingNotice(activeBooking.record)
      await persistBookingDuplicateNotified(true)
      await persistBookingFlowFlag(false)
      await persistConfirmFlag(false)
      await persistConflictPending(false)
      await persistActiveBookingOffered(false)
      await safe(() => setBookingDraft(conversation_id, null))
    } else if (sameVehicleOnFile) {
      conflictNote =
        `Repeat booking: customer is already on file for plate ` +
        `${activeBooking.record?.plate_number ?? "?"} and re-submitted the same booking details.`
    }

    let activeBookingContext: string | null = null
    if (!acknowledgeDuplicate && activeBooking.hasActiveBooking) {
      const activeDetails = formatActiveBooking(activeBooking)
      if (active_booking_offered) {
        activeBookingContext =
          "The customer already knows they have an existing active booking. Do not repeat the notice; just collect the new booking request normally."
      } else {
        await persistActiveBookingOffered(true)
        activeBookingContext =
          (activeDetails
            ? `The customer already has an existing active booking with 826 Auto Care:\n${activeDetails}\n\n`
            : "The customer already has an existing active booking with 826 Auto Care.\n\n") +
          "Briefly inform them their booking is currently active, then collect the new booking request normally. " +
          "Do NOT modify, cancel, or replace the existing booking — this is a separate request that goes to Sales."
      }
    } else if (!acknowledgeDuplicate && active_booking_offered) {
      // No active booking anymore — clear the stale notice flag.
      await persistActiveBookingOffered(false)
    }

    // Deterministic "you already have an active booking" line, prepended to the
    // deterministic reply on the turn the notice is first shown.
    const activeBookingLine =
      !acknowledgeDuplicate && activeBooking.hasActiveBooking && !active_booking_offered
        ? "Just so you know, you already have an active booking with us — I'll pass this along as a separate request.\n\n"
        : ""

    // branchContext is set only for branches that need a Gemini re-generation
    // (identity-conflict clarification, wander-off). Missing-fields and the
    // confirmation summary are rendered deterministically below.
    let branchContext: string | null = null
    let confirmSummary = false
    if (acknowledgeDuplicate) {
      // handled above — no branch context, no re-gen, no escalation
    } else if (missing.length > 0) {
      // Deterministic re-ask (never rephrases, never asks for a service type).
      // If the last two bot messages were already this same re-ask, the customer
      // is stuck — hand the booking to a human instead of asking a third time.
      const modelMsgs = history.filter((h) => h.role === "model")
      let trailingReasks = 0
      for (let i = modelMsgs.length - 1; i >= 0; i--) {
        if (ALL_MISSING_FIELDS_LEADS.some((lead) => modelMsgs[i].text.startsWith(lead))) trailingReasks++
        else break
      }
      if (trailingReasks >= 2) {
        escalate = true
        escalateBooking = false
        forceHumanEscalation = true
        escalateReason = "stuck_details"
        conflictNote =
          `Bot asked ${trailingReasks + 1}× in a row for the same booking detail(s) (${missing.join(", ")}) ` +
          "with no progress. Handing to a human."
        await persistConfirmFlag(false)
        await persistBookingFlowFlag(false)
      } else {
        escalate = false
        await persistConfirmFlag(false)
        reply = activeBookingLine + buildMissingFieldsPrompt(missing, effectiveLang)
      }
    } else {
      // Phase 4 (identity conflict): a COMPLETE booking whose details contradict
      // the canonical customer record is never finalized silently. The AI asks a
      // neutral clarification first (conflict_pending is persisted so the next
      // turn knows a conflict was already surfaced); only when the customer
      // confirms despite the conflict is the booking escalated to Sales for
      // verification, with a conflict_note recorded on the inquiry (Test 5).
      const conflict = await lookupIdentityConflict({
        psid: senderId,
        extracted,
        record: activeBooking.record,
      })

      if (conflict) {
        if (conflict_pending) {
          if (confirmRequested(messageBody) && !signal && awaiting_confirmation) {
            // Customer confirmed the booking despite the conflict, AND has
            // already seen their details summary (awaiting_confirmation) → Sales
            // verifies identity before anything is finalized.
            escalate = true
            escalateBooking = true
            conflictNote = conflict.note
            await persistConfirmFlag(false)
            await persistConflictPending(false)
            await persistBookingFlowFlag(false)
            branchContext =
              "The customer confirmed a booking that conflicts with the customer record on file. " +
              "The booking is escalated to Sales for identity verification. Do NOT finalize the details as correct."
          } else if (confirmRequested(messageBody) && !signal) {
            // Confirmed despite the conflict but the details summary was never
            // shown — show it first (keep conflict_pending so the next "yes"
            // reaches the branch above). Rendered deterministically below.
            escalate = false
            confirmSummary = true
            await persistConfirmFlag(true)
          } else {
            // Still conflicting and not confirmed → adapt the prompt so Gemini
            // understands the customer is responding to an existing identity
            // conflict clarification, not receiving one for the first time.
            escalate = false
            await persistConfirmFlag(false)
            branchContext =
              conflict.clarification +
              "\n\nThe customer has already been asked about this identity conflict and is now responding. " +
              "If they confirm the conflicting details are correct, the booking will be escalated to Sales for identity verification. " +
              "If they provide corrected details that match the customer record, the conflict is resolved. " +
              "If their response is unclear or does not address the identity conflict, repeat the neutral clarification question."
          }
        } else {
          // First time the conflict is detected → surface it, don't escalate.
          escalate = false
          await persistConflictPending(true)
          await persistConfirmFlag(false)
          branchContext = conflict.clarification
        }
      } else if (isPureConfirmation(messageBody) && awaiting_confirmation) {
        // Escalate only when a confirmation prompt was actually shown on a
        // previous turn (awaiting_confirmation was persisted then) AND this
        // message is essentially just an affirmation — not one that still
        // carries booking details (e.g. "opo, my email is …"), which is a
        // correction, not a final "yes". A premature "yes" — details just
        // became complete but no prompt was shown yet — falls through to the
        // confirmation branch below, so a customer can never be escalated to
        // Sales without first seeing their details summarized.
        escalate = true
        escalateBooking = true
        escalateReason = "booking_ready"
        await persistConfirmFlag(false)
        await persistConflictPending(false)
        await persistBookingFlowFlag(false)
        branchContext =
          "The customer has confirmed their complete booking details. The booking is ready to be handed over to Sales."
      } else if (awaiting_confirmation && !signal) {
        // The confirmation flag was set but this message is neither a
        // confirmation nor a booking detail — the customer wandered off. Clear
        // the flow flags and let the AI answer normally.
        escalate = false
        await persistConfirmFlag(false)
        await persistConflictPending(false)
        await persistBookingFlowFlag(false)
        await persistActiveBookingOffered(false)
        await persistBookingDuplicateNotified(false)
        await safe(() => setBookingDraft(conversation_id, null))
        branchContext =
          "The customer was asked to confirm their booking details but the last message is not a confirmation and carries no booking details — they have changed the subject. " +
          "Answer ONLY the question they actually asked. Do NOT mention, summarise, or re-offer the booking, and do not repeat their vehicle or plate number unless they ask about it. " +
          "Do not send a booking confirmation and do not escalate. If they want to resume booking, they will say so."
      } else {
        // All required details are collected but not yet confirmed. Show the
        // deterministic summary + confirm prompt (rendered below). Runs even
        // when the current message carries no booking signal, and swallows a
        // premature "yes" so the prompt is always shown before a booking can
        // escalate. Persist the confirmation flag so the next "Yes" escalates.
        escalate = false
        confirmSummary = true
        await persistConflictPending(false)
        await persistConfirmFlag(true)
      }
    }

    // branchContext is set only for branches that still need Gemini phrasing
    // (identity-conflict clarification, wander-off). Missing-fields, the
    // confirmation summary, and the vehicle-in-service notice are deterministic.
    if (branchContext !== null) {
      const bookingContext: string = activeBookingContext
        ? `${activeBookingContext}\n\n${branchContext}`
        : branchContext

      try {
        const flowResult = await generateChatbotReply({
          message: messageBody,
          history,
          settings,
          system_prompt,
          knowledge,
          vehicleContext,
          bookingContext,
        })
        if (flowResult.reply?.trim()) reply = flowResult.reply.trim()
        // Merge, never replace — a partial re-gen must not drop fields already
        // collected on the draft (would corrupt the inquiry handed to Sales).
        extracted = mergeBookingDetails(extracted, flowResult.customer)
      } catch (err) {
        console.error("[webhook/facebook] booking-flow reply failed:", err)
      }
    }

    // Render the confirmation summary deterministically from the freshest
    // extraction so the customer always sees every detail before confirming.
    if (confirmSummary && !escalate && extracted && isCompleteBooking(extracted)) {
      reply = activeBookingLine + buildBookingSummary(extracted, effectiveLang)
    }

    // Bug 8/10 backstop: a booking-flow reply must never ask which service the
    // customer wants, nor claim the booking is already done, before it has
    // actually been handed to Sales. Fall back to the deterministic text.
    if (!escalateBooking && reply) {
      const asksService = /\b(which|what|anong)\b[^.?!]{0,24}\b(service|services|package|treatment)\b/i.test(reply)
      const claimsDone = /\b(booking|appointment|reservation)\b[^.?!]{0,30}\b(is|has been|was|now|been)\b[^.?!]{0,14}\b(confirmed|submitted|received|scheduled|booked|placed)\b/i.test(reply)
      if (asksService || claimsDone) {
        reply =
          extracted && isCompleteBooking(extracted)
            ? activeBookingLine + buildBookingSummary(extracted, effectiveLang)
            : activeBookingLine + buildMissingFieldsPrompt(missingBookingFields(extracted), effectiveLang)
      }
    }
  }

  // A booking only ever reaches Sales through the deterministic confirm step
  // inside the block above (escalateBooking), or when the booking flow itself
  // routes the customer to a human (forceHumanEscalation). The model's own
  // escalate flag must never shortcut the confirmation step.
  if (
    bookingFlow &&
    !humanRequested &&
    !reportIntent &&
    !existingBookingIntent &&
    !escalateBooking &&
    !forceHumanEscalation
  ) {
    escalate = false
  }

  // If the main reply calls produced no customer details but we still escalated
  // (human request, report, or generic AI escalation), run a focused second-pass
  // extraction so the inquiry's extracted_* fields are filled.
  if (escalate && !hasExtractedDetails(extracted)) {
    try {
      const fallback = await extractCustomerDetails({
        message: messageBody,
        history,
        settings,
        system_prompt,
        knowledge,
      })
      extracted = mergeBookingDetails(extracted, fallback)
    } catch (err) {
      console.error("[webhook/facebook] extraction fallback failed:", err)
    }
  }

  if (escalate) {
    // A booking escalation must never hand Sales fewer fields than the customer
    // has already given — restore anything a late Gemini pass dropped.
    if (bookingFlow) extracted = mergeBookingDetails(booking_draft, extracted)

    await setConversationStatus(conversation_id, "pending")

    // Inquiry record (only on escalation) so Inquiry Management keeps working.
    // Any customer details the AI identified are stored in extracted_* columns.
    //
    // Escalation type priority:
    //   1. Customer explicitly asked for a human          → Human Response
    //   2. Existing-booking operation (change/cancel/modify) → Human Response
    //   3. Customer reported a concern/complaint          → Report
    //   4. Booking confirmed (booking flow + complete)    → Booking
    //   5. Anything else                                  → Human Response
    let inquiry_type: "Booking" | "Human Response" | "Report"
    if (humanRequested) {
      inquiry_type = "Human Response"
    } else if (existingBookingIntent) {
      inquiry_type = "Human Response"
    } else if (forceHumanEscalation) {
      // Booking flow routed the customer to a human (re-booking an in-service
      // vehicle, or stuck on details) — NOT a booking to be confirmed.
      inquiry_type = "Human Response"
    } else if (reportIntent) {
      inquiry_type = "Report"
    } else if (
      bookingFlow &&
      (escalateBooking || aiReason === "booking_confirmed" || isCompleteBooking(extracted))
    ) {
      inquiry_type = "Booking"
    } else {
      inquiry_type = "Human Response"
    }

    const { data: newInquiry, error: inquiryErr } = await admin.from("inquiry").insert({
      messenger_name: profile.name,
      psid: senderId,
      inquiry_type,
      status: "open",
      escalated_at: timestamp,
      last_message: messageBody,
      conflict_note:     conflictNote,
      extracted_name:    extracted?.full_name      ?? null,
      extracted_contact: extracted?.contact_number ?? null,
      extracted_plate:   extracted?.plate_number   ?? null,
      extracted_vehicle: extracted?.vehicle_unit   ?? null,
      extracted_email:   extracted?.email          ?? null,
    }).select("id").single()
    if (inquiryErr) console.error("[webhook/facebook] inquiry insert failed:", inquiryErr.message)

    // ── Notify Sales users — always, for these inquiry types (mandatory) ────
    // Report is included: it's the genuine-complaint path (a real concern
    // reached this branch, whether by explicit request or two consecutive
    // "complaint" classifications), and the bot's own escalation message
    // promises a staff member will personally follow up — this notification
    // is what makes that true.
    if (inquiry_type === "Booking" || inquiry_type === "Human Response" || inquiry_type === "Report") {
      const label = inquiry_type === "Report" ? "⚠️ New Report (concern) inquiry" : `New ${inquiry_type} inquiry`
      await notifyRole(admin, "sales", {
        type:       "inquiry",
        message:    `${label} from ${profile.name}`,
        inquiry_id: newInquiry?.id ?? null,
      })
    }

    // A suspected impersonation attempt always notifies Sales too, so it is
    // seen in real time, not just in the log. Same inquiry row created above.
    if (linkState.escalation?.impersonation) {
      await notifyRole(admin, "sales", {
        type:       "inquiry",
        message:    `⚠️ Possible impersonation attempt from ${profile.name}`,
        inquiry_id: newInquiry?.id ?? null,
      })
    }

    // Booking requests first receive the configured confirmation message, then
    // the escalation ack — the customer knows their booking was received before
    // being told a human will follow up.
    if (inquiry_type === "Booking") {
      const bookingMsg = pickCopy(effectiveLang, bookingTemplate.en, bookingTemplate.fil)
      const confirmId = await sendMessengerText(senderId, bookingMsg)
      await insertMessage({
        conversation_id,
        sender_type: "agent",
        message_body: bookingMsg,
        sent_at: new Date().toISOString(),
        fb_message_id: confirmId,
      })
    }

    // Existing-booking operations first receive the handoff message so the
    // customer knows a human will assist with their existing booking.
    if (existingBookingIntent) {
      const existingBookingMsg = existingBookingHandoff(effectiveLang)
      const handoffId = await sendMessengerText(senderId, existingBookingMsg)
      await insertMessage({
        conversation_id,
        sender_type: "agent",
        message_body: existingBookingMsg,
        sent_at: new Date().toISOString(),
        fb_message_id: handoffId,
      })
    }

    // Acknowledge to the customer that a human will follow up (no quick replies —
    // a human now owns the thread).
    const escalationMsg = escalationAck(effectiveLang, escalateReason, escalationTemplate)
    const fbId = await sendMessengerText(senderId, escalationMsg)
    await insertMessage({
      conversation_id,
      sender_type: "agent",
      message_body: escalationMsg,
      sent_at: new Date().toISOString(),
      fb_message_id: fbId,
    })

    // Escalated threads are now owned by Sales; leave any status flow.
    try {
      await setVehicleInquiry(conversation_id, false)
      await setBookingFlow(conversation_id, false)
    } catch (err) {
      console.error("[webhook/facebook] flow reset failed:", err)
    }
    await persistConfirmFlag(false)
    await persistActiveBookingOffered(false)
    await persistBookingDuplicateNotified(false)
    await persistConflictPending(false)
    await safe(() => setAwaitingLinkVerification(conversation_id, false))
    await safe(() => setLinkAttempts(conversation_id, 0))
    await safe(() => setLinkConflictPending(conversation_id, false))
    await safe(() => setViolationStreaks(conversation_id, 0, 0, 0))
    await safe(() => setBookingDraft(conversation_id, null))
    return
  }

  // Not escalated → send the AI reply with the standard quick-reply menu always
  // attached, including in answer to a quick-reply tap. Messenger drops the menu
  // from the thread the moment a button is tapped, so re-sending it every turn is
  // what keeps the buttons reachable without the customer typing. The booking
  // confirmation is requested in plain text (no confirm buttons), so the standard
  // menu is always what the customer sees during the booking flow.
  if (reply) {
    // Append the graduated-violation warning (set when the customer is one turn
    // away from an off-topic / policy escalation).
    if (violationWarning) reply = `${reply}${violationWarning}`
    const fbId = await sendMessengerQuickReply(senderId, reply, quickRepliesFor(effectiveLang))
    await insertMessage({
      conversation_id,
      sender_type: "agent",
      message_body: reply,
      sent_at: new Date().toISOString(),
      fb_message_id: fbId,
    })
    // Re-open (or keep open) so the chat stays out of the Sales view.
    await setConversationStatus(conversation_id, "open")
  }
}
