/**
 * Person-name validation shared by the forms and the API routes behind them, so
 * the client-side message and the server-side gate can never drift apart.
 *
 * Allows letters (including accented ones), spaces, hyphens, apostrophes and
 * periods — the characters that legitimately appear in names like "Mary-Jane",
 * "O'Brien" or "Jr.". Rejects digits and other symbols.
 */
import { hasInvisible, stripInvisible } from "@/lib/text"

const NAME_PATTERN = /^\p{L}[\p{L}\s'’.-]*$/u
const DISALLOWED_NAME_CHARS = /[^\p{L}\s'’.-]/gu

/** Hint shown when `sanitizeNameInput` drops something the user typed. */
export const NAME_INPUT_BLOCKED_MESSAGE = "Numbers, emoji and invisible characters aren't allowed in names."

/**
 * Strips characters a name can never contain (digits, emoji, symbols) as the
 * user types. Doesn't trim, so typing the space between words still works.
 * NFC first so a decomposed accent (e + combining mark) becomes "é" instead of
 * having its mark stripped.
 */
export function sanitizeNameInput(raw: string): string {
  // Invisible "letters" like the Hangul filler (ㅤ) pass DISALLOWED_NAME_CHARS
  // because Unicode classes them as letters — strip them explicitly.
  return stripInvisible(raw.normalize("NFC").replace(DISALLOWED_NAME_CHARS, ""))
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
  // Checked before length: "ㅤㅤ" (two Hangul fillers) is 2 "letters" that
  // display as nothing, which is how a blank-looking last name got through.
  if (hasInvisible(value)) return `${label} contains invisible characters. Please type it again.`
  if (value.length < 2) return `${label} must be at least 2 characters.`
  if (value.length > max) return `${label} must be ${max} characters or fewer.`
  if (!NAME_PATTERN.test(value)) {
    return `${label} may only contain letters, spaces, hyphens, apostrophes, and periods.`
  }
  return null
}

/** "First" + "Last" → one normalized full name, as stored in `full_name`. */
export function joinName(first: string | null | undefined, last: string | null | undefined): string {
  return normalizeName(`${first ?? ""} ${last ?? ""}`)
}

// Words that begin a surname rather than end a given name, so "Juan Dela
// Cruz" splits as Juan / Dela Cruz, not Juan Dela / Cruz.
const SURNAME_PARTICLES = new Set([
  "de", "del", "dela", "delos", "la", "las", "los", "san", "sta", "sta.", "santa", "santo", "van", "von", "da", "di", "du",
])

/**
 * Best-effort split of a stored full name into first / last, for pre-filling
 * the First Name and Last Name boxes (the user can still correct it). The last
 * name starts at the last word, pulled back over any surname particles before
 * it. A single word is treated as a first name with no last name.
 */
export function splitFullName(full: string | null | undefined): { first: string; last: string } {
  const words = normalizeName(full).split(" ").filter(Boolean)
  if (words.length <= 1) return { first: words[0] ?? "", last: "" }
  let start = words.length - 1
  while (start > 1 && SURNAME_PARTICLES.has(words[start - 1].toLowerCase())) start--
  return { first: words.slice(0, start).join(" "), last: words.slice(start).join(" ") }
}

/**
 * `validateName` for a single full-name value (what the server receives),
 * plus: it must contain both a first and a last name.
 */
export function validateFullName(raw: string | null | undefined, label = "Name", max = 255): string | null {
  const base = validateName(raw, label, max)
  if (base) return base
  if (normalizeName(raw).split(" ").length < 2) return "Enter both a first and last name."
  return null
}

// ── Capitalization ───────────────────────────────────────────────────────────
// Names are saved in one consistent format ("Juan Dela Cruz", not "JUAN DELA
// CRUZ" or "juan dela cruz"). The same rules are mirrored in SQL by
// supabase/migrations/20261118000001_format_names.sql for existing rows.

/** Short forms written with a period: "Ma." (Maria), "Jr.", "Sr.", "Sto.", "Sta.". */
const NAME_ABBREVIATIONS: Record<string, string> = { ma: "Ma.", jr: "Jr.", sr: "Sr.", sto: "Sto.", sta: "Sta." }
/** Generational suffixes kept in capitals. V and X are left out: a lone letter is an initial. */
const ROMAN_SUFFIXES = new Set(["ii", "iii", "iv"])

const isMixedCase = (w: string) => w !== w.toUpperCase() && w !== w.toLowerCase()

/** "o'BRIEN" / "MARY-JANE" → "O'Brien" / "Mary-Jane": a capital after every hyphen and apostrophe. */
function capitalizeParts(word: string): string {
  return word
    .toLowerCase()
    .split(/([-'’])/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join("")
}

/** One word of a person's name. */
function formatNameWord(word: string): string {
  const bare = word.replace(/\.$/, "").toLowerCase()
  if (NAME_ABBREVIATIONS[bare]) return NAME_ABBREVIATIONS[bare]
  if (ROMAN_SUFFIXES.has(bare)) return bare.toUpperCase()
  // A single letter is a middle initial: "a" / "A." → "A."
  if (/^\p{L}\.?$/u.test(word)) return `${word[0].toUpperCase()}.`
  // Typed with deliberate mixed case ("McArthur", "DeGuzman"): keep it.
  if (isMixedCase(word)) return word
  const cased = capitalizeParts(word)
  // "MCDONALD" → "McDonald" (only when something follows the "Mc").
  return /^Mc\p{L}{2,}/u.test(cased) ? `Mc${cased[2].toUpperCase()}${cased.slice(3)}` : cased
}

/**
 * A person's name in the format every screen shows: "MA CLARA A SANTOS JR" →
 * "Ma. Clara A. Santos Jr.", "juan dela cruz" → "Juan Dela Cruz". Words typed
 * in deliberate mixed case are kept. Also trims and collapses spaces.
 */
export function formatPersonName(raw: string | null | undefined): string {
  return normalizeName(raw).split(" ").filter(Boolean).map(formatNameWord).join(" ")
}

/** `formatPersonName` that keeps null/empty as null, for optional DB fields. */
export function formatPersonNameOrNull(raw: string | null | undefined): string | null {
  const v = formatPersonName(raw)
  return v ? v : null
}

/** Shop terms always written in capitals in a service or stage name. */
const SERVICE_ACRONYMS = new Set(["ppf", "suv", "auv", "uv", "ir", "ac", "led", "hid", "oem", "diy", "pdr", "cr"])
/** Joining words kept lowercase inside a title ("Wash and Wax"). */
const SERVICE_SMALL_WORDS = new Set(["and", "or", "of", "with", "for", "the", "in", "on", "to", "&"])

/**
 * A service, service type or stage name in Title Case, keeping shop acronyms
 * and codes: "CERAMIC COATING" → "Ceramic Coating", "full body ppf" →
 * "Full Body PPF", "F1 Mod - Installer Stage" stays as typed.
 */
export function formatServiceName(raw: string | null | undefined): string {
  const words = normalizeName(raw).split(" ").filter(Boolean)
  return words
    .map((word, i) => {
      const lower = word.toLowerCase()
      if (SERVICE_ACRONYMS.has(lower)) return lower.toUpperCase()
      if (/\d/.test(word)) return word
      if (isMixedCase(word)) return word
      if (i > 0 && SERVICE_SMALL_WORDS.has(lower)) return lower
      return capitalizeParts(word)
    })
    .join(" ")
}
