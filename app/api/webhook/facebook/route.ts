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
  getConversationHistory,
} from "@/lib/messenger/messenger-data"
import {
  loadChatbotConfig,
  loadKnowledgeBase,
  generateChatbotReply,
  extractCustomerDetails,
  requestedHuman,
  hasBookingIntent,
  hasStatusIntent,
  missingBookingFields,
  confirmRequested,
  isPureConfirmation,
  isCompleteBooking,
  buildBookingSummary,
  hasExistingBookingIntent,
  type ChatbotReply,
  type CustomerDetails,
} from "@/lib/messenger/chatbot"
import {
  lookupActiveBooking,
  formatActiveBooking,
  lookupIdentityConflict,
  isSameVehicleOnFile,
  buildDuplicateBookingNotice,
} from "@/lib/messenger/booking"
import {
  sendMessengerText,
  sendMessengerQuickReply,
  fetchMessengerProfile,
  type MessengerQuickReply,
} from "@/lib/messenger/graph"
import {
  resolveOwnVehicleStatus,
  formatOwnVehicleStatus,
  assessLinkClaim,
  normalizePlate,
} from "@/lib/messenger/vehicle"
import { logAudit } from "@/hooks/audit-helpers"

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

const ESCALATION_ACK =
  "A member of our team will assist you shortly. Thank you for reaching out to 826 Auto Care!"

// Handoff message for existing-booking operations (change/cancel/modify/
// reschedule). These always escalate to Sales — never collected as a new booking.
const EXISTING_BOOKING_HANDOFF =
  "I'll connect you with our team so they can assist with your existing booking."

// Booking-flow context for the confirmation prompt: summarize the collected
// details and ask the customer to confirm before the booking is escalated.
const CONFIRM_BOOKING_CONTEXT =
  "All required booking details are collected (Full Name, Contact Number, Plate Number, Vehicle Type, Email). " +
  "Summarize the details back to the customer and ask them to confirm, phrased in the customer's configured language like: " +
  "'Is this information correct? Reply YES to confirm.' " +
  "Do NOT send the final booking confirmation message and do NOT escalate until the customer confirms."

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

const QUICK_REPLIES: MessengerQuickReply[] = [
  { content_type: "text", title: "Services & Prices", payload: "services" },
  { content_type: "text", title: "Booking",           payload: "booking"  },
  { content_type: "text", title: "Report a Concern",  payload: "report"   },
  { content_type: "text", title: "Vehicle Status",    payload: "status"   },
]

/** True when the extracted customer object carries at least one real detail. */
const hasExtractedDetails = (c: CustomerDetails | null | undefined): boolean =>
  Boolean(
    c &&
    (c.full_name || c.contact_number || c.plate_number || c.vehicle_unit || c.email)
  )

// Loose PH plate-number pattern (e.g. ABC 1234, XYZ-567, 1234 ABC).
const PLATE_PATTERN = /\b[A-Z]{1,4}\s?-?\s?\d{1,6}(?:\s?-\s?[A-Z]{1,2})?\b/i

// Loose Philippine mobile-number pattern (e.g. 0917 555 0101, +639175550101).
const PHONE_PATTERN = /(?:\+?63|0)\s?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/

// Loose email pattern (e.g. john@example.com).
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/

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
  const { conversation_id, status, is_vehicle_inquiry, is_booking_flow, awaiting_confirmation, active_booking_offered, booking_duplicate_notified, conflict_pending, awaiting_link_verification, link_attempts } =
    await getOrCreateConversationByPsid(senderId, profile.name)

  // Best-effort flag persistence: a failure here must not abort the reply.
  const safe = async (fn: () => Promise<unknown>) => {
    try { await fn() } catch (err) { console.error("[webhook/facebook] state persist failed:", err) }
  }
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

  const quickReplyPayload = msg.quick_reply?.payload ?? null

  // ── Account-linking verification ─────────────────────────────────────────
  // When the bot has asked an unlinked customer for their plate + booking phone,
  // the next message is a link CLAIM. Handled BEFORE any booking-signal logic so
  // a plate/phone reply is not swallowed by the booking flow.
  //
  // The bot never links the account itself — linking is a persistent access
  // grant. Every claim is routed to Sales, who verify identity out-of-band and
  // set `psid` on the customer record. No status is shown until then.
  let linkedVehicleContext: string | null = null
  let linkEscalation: { reason: string; note: string | null; impersonation?: boolean } | null = null
  if (awaiting_link_verification) {
    const lp = messageBody.match(PLATE_PATTERN)?.[0] ?? ""
    const lph = messageBody.match(PHONE_PATTERN)?.[0] ?? ""
    const plateNorm = normalizePlate(lp)

    if (!lp || !lph) {
      // Not a plate + phone pair — the customer wandered off the linking step.
      await safe(() => setAwaitingLinkVerification(conversation_id, false))
    } else {
      const claim = await assessLinkClaim({ psid: senderId, plate: lp, phone: lph })
      const clearLink = async () => {
        await safe(() => setAwaitingLinkVerification(conversation_id, false))
        await safe(() => setLinkAttempts(conversation_id, 0))
      }

      if (claim.kind === "owned_by_requester") {
        // Defensive — resolveOwnVehicleStatus should already have found this.
        await clearLink()
        linkedVehicleContext = formatOwnVehicleStatus(claim.outcome)
      } else if (claim.kind === "match_unlinked") {
        await clearLink()
        logAudit({ ...auditActor, category: "flag", action: "messenger: account link request", target: `psid=${senderId} plate=${plateNorm}` })
        linkEscalation = {
          reason: "account link request — pending Sales verification",
          note:
            `Account link request. Messenger PSID ${senderId} (FB name "${profile.name}") claims plate ${plateNorm}; ` +
            `the phone they gave matches the record for "${claim.recordName ?? "unknown"}". ` +
            `Verify identity (call the number on file / confirm at drop-off) before setting the PSID on that customer record.`,
        }
      } else if (claim.kind === "owned_by_other") {
        await clearLink()
        logAudit({ ...auditActor, category: "flag", action: "messenger: impersonation-suspected link attempt", target: `psid=${senderId} plate=${plateNorm} phoneMatched=${claim.phoneMatched}` })
        linkEscalation = {
          impersonation: true,
          reason: "possible impersonation — link attempt on a record owned by another Messenger account",
          note:
            `POSSIBLE IMPERSONATION. Messenger PSID ${senderId} (FB name "${profile.name}") tried to claim plate ${plateNorm}, ` +
            `which is already linked to a different Messenger account (phoneMatched=${claim.phoneMatched}). ` +
            `Do NOT re-link without confirming with the current owner.`,
        }
      } else {
        // no_record / phone_mismatch — let the customer self-correct, then escalate.
        const attempts = link_attempts + 1
        if (attempts >= 5) {
          await clearLink()
          logAudit({ ...auditActor, category: "flag", action: "messenger: link verification failed 5x", target: `psid=${senderId} last_plate=${plateNorm}` })
          linkEscalation = {
            reason: "account link — 5 unverified attempts",
            note: `Account link attempt failed verification 5 times. Last claim: plate ${plateNorm}, phone provided but no matching record.`,
          }
        } else {
          await safe(() => setLinkAttempts(conversation_id, attempts))
          const askAgain =
            "That didn't match our records. Please double-check your plate number and the phone number on your booking, then send them again."
          const mid = await sendMessengerText(senderId, askAgain)
          await insertMessage({ conversation_id, sender_type: "agent", message_body: askAgain, sent_at: new Date().toISOString(), fb_message_id: mid })
          return
        }
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
  const statusIntent =
    quickReplyPayload === "status" ||
    ((hasStatusIntent(messageBody) || (!bookingIntent && is_vehicle_inquiry)) &&
      !is_booking_flow &&
      !awaiting_confirmation)

  // An existing-booking operation (change/cancel/modify/reschedule) is never a
  // new booking — it is escalated to Sales for handling.
  const existingBookingIntent = hasExistingBookingIntent(messageBody)

  // A message carries a booking signal when it states booking intent or
  // contains a booking detail token (plate / phone / email).
  const signal = bookingSignal(messageBody)

  // Persist which flow the conversation is in so a bare follow-up reply
  // (e.g. just a plate + phone after the status template, or a vehicle type
  // that completes a booking) stays on the same track without needing the
  // keyword repeated.
  if (!awaiting_link_verification && !linkEscalation) {
    try {
      if (statusIntent) {
        await setVehicleInquiry(conversation_id, true)
        await setBookingFlow(conversation_id, false)
      } else if (existingBookingIntent) {
        await setVehicleInquiry(conversation_id, false)
        await setBookingFlow(conversation_id, false)
      } else if (bookingIntent || signal) {
        await setVehicleInquiry(conversation_id, false)
        await setBookingFlow(conversation_id, true)
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

  if (linkedVehicleContext) {
    vehicleContext = linkedVehicleContext
  } else if (statusIntent && !bookingIntent && !linkEscalation) {
    const outcome = await resolveOwnVehicleStatus(senderId)
    const jobPlates = outcome.kind === "ok" ? outcome.jobs.map((j) => normalizePlate(j.plate)) : []
    const focusPlate = plateInMsg && jobPlates.includes(plateInMsg) ? plateInMsg : undefined
    const plateMismatch =
      Boolean(plateInMsg) && !focusPlate && outcome.kind === "ok" && jobPlates.length > 0

    if (plateMismatch) {
      vehicleContext = formatOwnVehicleStatus(outcome, { plateMismatch: true })
      logAudit({ ...auditActor, category: "flag", action: "messenger status: plate not owned by requester", target: `psid=${senderId} requested_plate=${plateInMsg} account_plates=${jobPlates.join("/") || "none"}` })
    } else {
      vehicleContext = formatOwnVehicleStatus(outcome, { focusPlate })
      if (outcome.kind === "not_linked") {
        logAudit({ ...auditActor, category: "flag", action: "messenger status: no linked customer record", target: `psid=${senderId}${plateInMsg ? ` requested_plate=${plateInMsg}` : ""}` })
        // Ask for plate + booking phone so the next message can link the account.
        await safe(() => setAwaitingLinkVerification(conversation_id, true))
      }
    }
  }

  // AI auto-reply + escalation decision.
  const humanRequested = requestedHuman(messageBody)
  const reportIntent =
    quickReplyPayload === "report" ||
    REPORT_PATTERNS.some((re) => re.test(messageBody))

  let reply: string | null = null
  let escalate = humanRequested || reportIntent || existingBookingIntent
  let escalateReason: string | null = humanRequested
    ? "customer asked to speak with a human"
    : existingBookingIntent
      ? "customer wants to modify/cancel an existing booking"
      : null
  let aiReason: string | null = null
  let extracted: ChatbotReply["customer"] = null
  let settings: Awaited<ReturnType<typeof loadChatbotConfig>>["settings"] = null
  let system_prompt: string | null = null
  let knowledge: string | null = null

  try {
    const [{ settings: loadedSettings, system_prompt: loadedPrompt }, loadedKnowledge] =
      await Promise.all([
        loadChatbotConfig(),
        loadKnowledgeBase(),
      ])
    settings = loadedSettings
    system_prompt = loadedPrompt
    knowledge = loadedKnowledge

    const result = await generateChatbotReply({
      message: messageBody,
      history,
      settings,
      system_prompt,
      knowledge,
      vehicleContext,
    })

    reply = result.reply?.trim() || null
    escalate = result.escalate || humanRequested || reportIntent || existingBookingIntent
    escalateReason = humanRequested
      ? "customer asked to speak with a human"
      : existingBookingIntent
        ? "customer wants to modify/cancel an existing booking"
        : (result.reason ?? null)
    aiReason = result.reason ?? null
    extracted = result.customer ?? null

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
    escalateReason = "chatbot error"
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
  const bookingFlow =
    !awaiting_link_verification && !linkEscalation &&
    ((signal && !statusIntent) || is_booking_flow || awaiting_confirmation)
  let escalateBooking = false
  // Set when a complete booking carries an identity conflict that the customer
  // confirmed anyway — recorded on the inquiry so Sales can verify (Phase 4).
  let conflictNote: string | null = null

  // Every account-link claim is routed to Sales for out-of-band verification.
  if (linkEscalation) {
    escalate = true
    escalateReason = linkEscalation.reason
    if (linkEscalation.note) conflictNote = linkEscalation.note
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

  if (bookingFlow && !statusIntent && !humanRequested && !reportIntent && !existingBookingIntent) {
    const missing = missingBookingFields(extracted)
    // Whether we are about to re-ask for missing details. If the flow re-gen
    // below refreshes the extraction and shows all details ARE present, we
    // recover by switching to the confirmation prompt instead of re-asking.
    let wasMissingBranch = false

    // A returning customer (same psid) who already has an ACTIVE booking (a live
    // job) is briefly informed their booking is currently active, but the new
    // booking request is still collected and submitted to Sales normally. The
    // notice is shown once per booking attempt (active_booking_offered). A
    // customer_record alone does not count as an active booking.
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

    // Null while the duplicate-acknowledgement path owns the reply — the
    // re-gen / confirmation logic below is skipped entirely in that case.
    let branchContext: string | null = null
    // Set when the branch wants the customer to see a details summary + confirm
    // prompt. The summary is then rendered deterministically (buildBookingSummary)
    // rather than left to Gemini, so the customer ALWAYS sees their details
    // before a "yes" can hand the booking to Sales.
    let confirmSummary = false
    if (acknowledgeDuplicate) {
      // handled above — no branch context, no re-gen, no escalation
    } else if (missing.length > 0) {
      escalate = false
      wasMissingBranch = true
      await persistConfirmFlag(false)
      branchContext =
        `The customer is in a booking flow but the following required detail(s) are not confirmed from the latest message: ${missing.join(", ")}. ` +
        "If the customer already provided any of these details earlier in the conversation, treat them as collected and include them in your structured customer extraction. " +
        "Politely ask the customer to provide only the truly missing details. Do NOT send the final booking confirmation and do NOT escalate until all details are collected."
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
          if (confirmRequested(messageBody) && !signal) {
            // Customer confirmed the booking despite the conflict → Sales
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
        branchContext =
          "The customer was asked to confirm their booking details but the last message is not a confirmation and carries no booking details. " +
          "Answer the customer normally; you may briefly re-offer to continue their booking if it is natural to do so, but do not send the final booking confirmation and do not escalate."
      } else {
        // All required details are collected but not yet confirmed. Summarize the
        // details and ask the customer to confirm — this runs even when the
        // current message carries no booking signal (e.g. it completed the set
        // with just a vehicle type), and also swallows a premature "yes" so the
        // prompt is always shown before the booking can escalate. Persist the
        // confirmation flag so the next "Yes" escalates.
        escalate = false
        confirmSummary = true
        await persistConflictPending(false)
        await persistConfirmFlag(true)
        branchContext = CONFIRM_BOOKING_CONTEXT
      }
    }

    // branchContext is null only on the duplicate-acknowledgement path, which
    // already owns `reply` and needs no Gemini re-gen.
    if (branchContext !== null) {
      const bookingContext: string = activeBookingContext
        ? `${activeBookingContext}\n\n${branchContext}`
        : branchContext

      // Re-generate the reply with the booking-flow context (and get a more
      // reliable customer extraction). The escalation path ignores `reply`, so
      // this is safe for the confirmed case too.
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
        if (hasExtractedDetails(flowResult.customer)) extracted = flowResult.customer
      } catch (err) {
        console.error("[webhook/facebook] booking-flow reply failed:", err)
      }

      // Recovery: the re-gen's refreshed extraction (which sees the full history)
      // can show all details are actually collected even though the first pass
      // looked incomplete. Instead of sending a redundant re-ask for details the
      // customer already gave, switch to the confirmation prompt. Costs one extra
      // Gemini call only in this rare case.
      if (wasMissingBranch && isCompleteBooking(extracted)) {
        // If the completed details carry an identity conflict, surface the
        // clarification instead of the normal confirmation prompt; otherwise
        // switch to confirmation.
        const conflict = await lookupIdentityConflict({
          psid: senderId,
          extracted,
          record: activeBooking.record,
        })
        await persistConfirmFlag(!conflict)
        await persistConflictPending(Boolean(conflict))
        if (conflict) {
          try {
            const confirmResult = await generateChatbotReply({
              message: messageBody,
              history,
              settings,
              system_prompt,
              knowledge,
              vehicleContext,
              bookingContext: conflict.clarification,
            })
            if (confirmResult.reply?.trim()) reply = confirmResult.reply.trim()
            if (hasExtractedDetails(confirmResult.customer)) extracted = confirmResult.customer
          } catch (err) {
            console.error("[webhook/facebook] booking recovery reply failed:", err)
          }
        } else {
          // No conflict → show the deterministic details summary + confirm prompt.
          escalate = false
          confirmSummary = true
        }
      }
    }

    // Render the confirmation summary deterministically from the freshest
    // extraction so the customer always sees every detail before confirming.
    if (confirmSummary && !escalate && extracted && isCompleteBooking(extracted)) {
      reply = buildBookingSummary(extracted)
    }
  }

  // A booking only ever reaches Sales through the deterministic confirm step
  // inside the block above (escalateBooking). The model's own escalate flag must
  // never shortcut the confirmation step for a booking-flow conversation.
  if (
    bookingFlow &&
    !humanRequested &&
    !reportIntent &&
    !existingBookingIntent &&
    !escalateBooking
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
      if (hasExtractedDetails(fallback)) extracted = fallback
    } catch (err) {
      console.error("[webhook/facebook] extraction fallback failed:", err)
    }
  }

  if (escalate) {
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

    const { error: inquiryErr } = await admin.from("inquiry").insert({
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
    })
    if (inquiryErr) console.error("[webhook/facebook] inquiry insert failed:", inquiryErr.message)

    // ── Notify Sales users (gated by notify_sales + inquiry type) ───────────
    if (
      settings?.notify_sales &&
      (inquiry_type === "Booking" || inquiry_type === "Human Response")
    ) {
      try {
        const { data: salesUsers } = await admin
          .from("user_account")
          .select("id")
          .eq("role", "sales")
          .eq("is_archived", false)

        if (salesUsers?.length) {
          const notifRows = salesUsers.map((u: any) => ({
            user_id:      u.id,
            type:         "inquiry",
            message:      `New ${inquiry_type} inquiry from ${profile.name}`,
            job_order_id: null,
            is_read:      false,
          }))
          await admin.from("notification").insert(notifRows)
        }
      } catch (notifErr) {
        console.error("[webhook/facebook] sales notification fan-out failed:", notifErr)
      }
    }

    // A suspected impersonation attempt always notifies Sales — regardless of
    // the notify_sales setting — so it is seen in real time, not just in the log.
    if (linkEscalation?.impersonation) {
      try {
        const { data: salesUsers } = await admin
          .from("user_account")
          .select("id")
          .eq("role", "sales")
          .eq("is_archived", false)

        if (salesUsers?.length) {
          await admin.from("notification").insert(
            salesUsers.map((u: any) => ({
              user_id:      u.id,
              type:         "inquiry",
              message:      `⚠️ Possible impersonation attempt from ${profile.name}`,
              job_order_id: null,
              is_read:      false,
            }))
          )
        }
      } catch (notifErr) {
        console.error("[webhook/facebook] impersonation notification failed:", notifErr)
      }
    }

    // Booking requests first receive the configured confirmation message, then
    // the escalation ack — the customer knows their booking was received before
    // being told a human will follow up.
    if (inquiry_type === "Booking" && settings?.booking_message) {
      const confirmId = await sendMessengerText(senderId, settings.booking_message)
      await insertMessage({
        conversation_id,
        sender_type: "agent",
        message_body: settings.booking_message,
        sent_at: new Date().toISOString(),
        fb_message_id: confirmId,
      })
    }

    // Existing-booking operations first receive the handoff message so the
    // customer knows a human will assist with their existing booking.
    if (existingBookingIntent) {
      const handoffId = await sendMessengerText(senderId, EXISTING_BOOKING_HANDOFF)
      await insertMessage({
        conversation_id,
        sender_type: "agent",
        message_body: EXISTING_BOOKING_HANDOFF,
        sent_at: new Date().toISOString(),
        fb_message_id: handoffId,
      })
    }

    // Acknowledge to the customer that a human will follow up (no quick replies —
    // a human now owns the thread).
    const fbId = await sendMessengerText(senderId, ESCALATION_ACK)
    await insertMessage({
      conversation_id,
      sender_type: "agent",
      message_body: ESCALATION_ACK,
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
    return
  }

  // Not escalated → send the AI reply. Attach the standard quick-reply menu
  // unless this inbound was itself a quick-reply tap (answer it plainly; the
  // menu returns on the next free-text message). The booking confirmation is
  // requested in plain text (no confirm buttons), so the standard menu is
  // always what the customer sees during the booking flow.
  if (reply) {
    const fbId = quickReplyPayload
      ? await sendMessengerText(senderId, reply)
      : await sendMessengerQuickReply(senderId, reply, QUICK_REPLIES)
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
