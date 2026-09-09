/**
 * Deterministic booking/link detail patterns, shared by the Messenger webhook
 * (intent detection + account-link parsing) and the chatbot's token extraction.
 * One definition each — these used to be duplicated in both places and drifted.
 *
 * Boundary note: neither pattern may end (or begin) on `\b`. Customers routinely
 * send a phone and plate glued together with no separator — "09121231234XYZ-1234"
 * — and a word boundary between the "4" and the "X" does not exist, so a `\b`
 * anchor silently matches nothing and the whole message parses as neither.
 */

/**
 * Common short connector words that would otherwise misparse as a plate's
 * letter portion whenever one happens to sit right before a number in an
 * ordinary sentence — "is 25", "of 826", "at 5" all technically fit
 * `[A-Z]{1,4}\d+`, but none of these words is ever a real plate prefix. This
 * caused a real bug: an off-topic message ("...Mary is 23 years old...",
 * "...who is owner of 826?") got misread as containing a plate number, which
 * hijacked the whole reply into the deterministic booking flow instead of
 * the AI ever seeing it as off-topic. A word-list, not a grammar — this
 * fixes the false positives actually seen without narrowing what a real
 * plate can look like.
 */
const PLATE_FALSE_POSITIVE_WORDS = [
  "is", "of", "at", "on", "in", "to", "no", "we", "he", "it", "be", "as", "by",
  "or", "if", "so", "up", "am", "pm",
  "the", "are", "was", "has", "had", "not", "but", "you", "can", "may", "day",
  "old", "new", "out", "got", "let", "per", "via", "for", "and", "all", "get",
  "put", "our", "his", "her", "its", "who", "why", "how", "now", "top", "way",
  "use", "cost", "pay", "paid", "total", "price", "worth", "than", "just",
  "only", "over", "under", "about", "near", "give", "need", "want", "have",
  "like", "said", "says", "make", "made", "call", "chat", "text", "send",
  "sent", "with", "them", "were", "will", "does",
]

/**
 * Loose PH plate-number pattern (e.g. ABC 1234, XYZ-567, AAA-111-B).
 * `(?<![A-Z])` forbids only a preceding LETTER, so a digit may butt up against
 * the plate. A run of digits alone can never match — a letter is still
 * required. The negative lookahead rejects a `PLATE_FALSE_POSITIVE_WORDS`
 * entry immediately followed by a number, which otherwise reads as a plate.
 */
export const PLATE_PATTERN = new RegExp(
  `(?<![A-Z])(?!(?:${PLATE_FALSE_POSITIVE_WORDS.join("|")})\\s?-?\\s?\\d)[A-Z]{1,4}\\s?-?\\s?\\d{1,6}(?:\\s?-\\s?[A-Z]{1,2})?\\b`,
  "i"
)

/**
 * Loose Philippine mobile-number pattern (e.g. 0917 555 0101, +639175550101).
 * `(?!\d)` still refuses to stop mid-way through a longer digit run, but allows
 * a letter to follow.
 */
export const PHONE_PATTERN = /(?:\+?63|0)\s?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/

/** Loose email pattern (e.g. john@example.com). */
export const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/

/**
 * Job Order Code (e.g. JO-8X2K9F) — replaces plate+phone as the credential a
 * Messenger customer uses to link their account and check vehicle status.
 * Distinctive "JO-" prefix means a `\b` boundary is safe here, unlike the
 * plate/phone patterns above.
 */
export const JOB_ORDER_CODE_PATTERN = /\bJO-[2-9A-HJ-NP-Z]{6}\b/i

// Global variants for extracting EVERY occurrence (last match wins — a later
// correction supersedes an earlier value). Built from the sources above so the
// two forms can never diverge.
export const TOKEN_PLATE = new RegExp(PLATE_PATTERN.source, "gi")
export const TOKEN_PHONE = new RegExp(PHONE_PATTERN.source, "g")
export const TOKEN_EMAIL = new RegExp(EMAIL_PATTERN.source, "g")

/**
 * Pulls a Job Order Code out of free text, normalized to uppercase. Returns
 * "" when absent — the caller decides what that means.
 */
export function extractJobOrderCode(text: string): string {
  return text.match(JOB_ORDER_CODE_PATTERN)?.[0]?.toUpperCase() ?? ""
}

/**
 * Pulls the plate + phone pair out of an account-link reply. Customers send the
 * two glued together in either order, so the phone is matched FIRST and removed
 * before the plate is matched: on "XYZ-123409171234567" a direct plate match
 * cannot tell where the plate stops and the phone starts, but with the phone
 * already taken out, "XYZ-1234" is unambiguous.
 *
 * Either field comes back "" when absent — the caller decides what that means.
 */
export function parseLinkClaim(text: string): { plate: string; phone: string } {
  const phone = text.match(PHONE_PATTERN)?.[0] ?? ""
  const rest = phone ? text.replace(phone, " ") : text
  return { plate: rest.match(PLATE_PATTERN)?.[0] ?? "", phone }
}
