/**
 * Pure helpers for the realtime Inquiry Management list. Extracted so the two
 * rules that are easy to get wrong — announcing only genuinely new escalations,
 * and not yanking the selection out from under someone mid-reply — can be unit
 * tested without a browser or a Supabase connection.
 */

/**
 * Ids present in `next` but not in `prev`, preserving `next`'s ordering.
 *
 * The toast diffs the list rather than trusting the realtime event, because a
 * single escalation emits an INSERT and often a follow-up UPDATE; announcing
 * per-event would double-toast, and announcing on any event would toast when a
 * colleague merely resolves something.
 */
export function newInquiryIds(prev: string[], next: string[]): string[] {
  const known = new Set(prev)
  return next.filter((id) => !known.has(id))
}

/**
 * Which inquiry should be selected after a refresh.
 *
 * Keeps the current selection whenever it still exists — a realtime refresh
 * must never move someone off the inquiry they are reading. Falls back to the
 * first row only when nothing is selected (initial load) or the selected
 * inquiry has disappeared.
 */
export function resolveSelectedId(
  current: string | null,
  list: { id: string }[],
  pendingRequest?: string | null,
): string | null {
  if (pendingRequest) {
    // A notification click asked for this inquiry: use it once it's in the
    // list; until then keep waiting rather than snapping to the first row.
    return list.some((i) => i.id === pendingRequest) ? pendingRequest : current
  }
  if (current && list.some((i) => i.id === current)) return current
  return list.length > 0 ? list[0].id : null
}

/** Wording for the "new escalation arrived" toast. */
export function newInquiryToast(
  added: { messengerName: string; type: string }[],
): string {
  if (added.length === 1) {
    return `New ${added[0].type} escalation from ${added[0].messengerName}`
  }
  return `${added.length} new escalations`
}

/**
 * A heading for an inquiry's `conflict_note`, matched from the free-text the
 * webhook writes (app/api/webhook/facebook/route.ts) — there's no dedicated
 * reason column, so the note's own wording is the only signal. Everything
 * used to show as "Identity Conflict" regardless of why the conversation was
 * actually escalated — most visibly, a customer who'd already given complete
 * booking info but got stuck on the AI's vehicle-unit extraction (Bot asked
 * 3x…) read as an identity mismatch that never happened. Order matters: more
 * specific patterns are checked before the generic identity-conflict default.
 */
export function escalationHeading(conflictNote: string | null | undefined): string {
  if (!conflictNote) return "Escalation Note"
  const note = conflictNote
  if (/^Bot asked/.test(note)) return "Missing Booking Details"
  if (/^Repeat booking/.test(note)) return "Duplicate Booking"
  if (/^Re-booking plate/.test(note)) return "Vehicle Already In Service"
  if (/^Auto-escalated after repeated/.test(note)) return "Repeated Policy/Off-topic Messages"
  if (/^Auto-escalated: message classified/.test(note)) return "Possible Threat"
  if (/^POSSIBLE IMPERSONATION/.test(note)) return "Possible Impersonation"
  if (/^AI chatbot is disabled/.test(note)) return "AI Chatbot Disabled"
  return "Identity Conflict"
}
