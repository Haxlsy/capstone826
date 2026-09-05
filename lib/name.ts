/**
 * Person-name validation shared by the forms and the API routes behind them, so
 * the client-side message and the server-side gate can never drift apart.
 *
 * Allows letters (including accented ones), spaces, hyphens, apostrophes and
 * periods — the characters that legitimately appear in names like "Mary-Jane",
 * "O'Brien" or "Jr.". Rejects digits and other symbols.
 */
const NAME_PATTERN = /^\p{L}[\p{L}\s'’.-]*$/u

/** Trims and collapses runs of internal whitespace to a single space. */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ")
}

/**
 * Returns an error message when the name is unusable, or `null` when it's fine.
 * `label` names the field in the message, e.g. "First name".
 */
export function validateName(raw: string | null | undefined, label = "Name"): string | null {
  const value = normalizeName(raw)
  if (!value) return `${label} is required.`
  if (value.length < 2) return `${label} must be at least 2 characters.`
  if (value.length > 50) return `${label} must be 50 characters or fewer.`
  if (!NAME_PATTERN.test(value)) {
    return `${label} may only contain letters, spaces, hyphens, apostrophes, and periods.`
  }
  return null
}
