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
): string | null {
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
