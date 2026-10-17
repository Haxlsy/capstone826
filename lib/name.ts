/**
 * Person-name validation shared by the forms and the API routes behind them, so
 * the client-side message and the server-side gate can never drift apart.
 *
 * Allows letters (including accented ones), spaces, hyphens, apostrophes and
 * periods — the characters that legitimately appear in names like "Mary-Jane",
 * "O'Brien" or "Jr.". Rejects digits and other symbols.
 */
const NAME_PATTERN = /^\p{L}[\p{L}\s'’.-]*$/u
const DISALLOWED_NAME_CHARS = /[^\p{L}\s'’.-]/gu

/** Hint shown when `sanitizeNameInput` drops something the user typed. */
export const NAME_INPUT_BLOCKED_MESSAGE = "Numbers and emoji aren't allowed in names."

/**
 * Strips characters a name can never contain (digits, emoji, symbols) as the
 * user types. Doesn't trim, so typing the space between words still works.
 * NFC first so a decomposed accent (e + combining mark) becomes "é" instead of
 * having its mark stripped.
 */
export function sanitizeNameInput(raw: string): string {
  return raw.normalize("NFC").replace(DISALLOWED_NAME_CHARS, "")
}

/** Trims and collapses runs of internal whitespace to a single space. */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ")
}

/**
 * Returns an error message when the name is unusable, or `null` when it's fine.
 * `label` names the field in the message, e.g. "First name". `max` defaults to
 * the 50-char first/last name limit; a single full-name field passes its own.
 */
export function validateName(raw: string | null | undefined, label = "Name", max = 50): string | null {
  const value = normalizeName(raw)
  if (!value) return `${label} is required.`
  if (value.length < 2) return `${label} must be at least 2 characters.`
  if (value.length > max) return `${label} must be ${max} characters or fewer.`
  if (!NAME_PATTERN.test(value)) {
    return `${label} may only contain letters, spaces, hyphens, apostrophes, and periods.`
  }
  return null
}
