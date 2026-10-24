/**
 * Emoji filtering for free-text fields (service names, stage names, presets…)
 * shared by the forms and the API routes behind them. Unlike `lib/name.ts`,
 * digits and symbols stay allowed here ("Stage 2", "9H Ceramic").
 *
 * Matches pictographs plus the pieces emoji are assembled from: regional
 * indicator letters (flags), skin-tone modifiers, the zero-width joiner,
 * the emoji variation selector and the keycap mark.
 */
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍️⃣]/gu

/**
 * Characters that render as nothing (or blank space) but aren't whitespace, so
 * `trim()` and `\s` miss them. Some are even classed as LETTERS by Unicode
 * (the Hangul fillers), which is how a name made only of "ㅤ" (U+3164) passed
 * the name rule and looked empty. Never legitimate in a name or label here.
 *
 * Hangul fillers (U+115F, U+1160, U+3164, U+FFA0), braille blank (U+2800),
 * zero-width / direction / word-joiner marks (U+200B–U+200F, U+2060–U+2064),
 * byte-order mark (U+FEFF), soft hyphen (U+00AD), combining grapheme joiner
 * (U+034F).
 */
const INVISIBLE = /[\u115F\u1160\u3164\uFFA0\u2800\u200B-\u200F\u2060-\u2064\uFEFF\u00AD\u034F]/g

/** Removes invisible characters (see INVISIBLE). Doesn't trim. */
export function stripInvisible(raw: string): string {
  return raw.replace(INVISIBLE, "")
}

/** True when a value is a string containing any invisible character. */
export function hasInvisible(raw: unknown): boolean {
  return typeof raw === "string" && stripInvisible(raw) !== raw
}

/** Hint shown when `stripEmoji` drops something the user typed. */
export const EMOJI_BLOCKED_MESSAGE = "Emoji and invisible characters aren't allowed here."

/** Removes emoji and invisible characters as the user types or pastes. Doesn't trim. */
export function stripEmoji(raw: string): string {
  return stripInvisible(raw.replace(EMOJI, ""))
}

/** True when a value is a string containing any emoji or invisible character (for server checks). */
export function hasEmoji(raw: unknown): boolean {
  return typeof raw === "string" && stripEmoji(raw) !== raw
}

/** 400-ready message for a field with emoji or invisible characters, or `null` when clean. */
export function emojiError(raw: unknown, label: string): string | null {
  if (hasInvisible(raw)) return `${label} can't contain invisible characters.`
  return hasEmoji(raw) ? `${label} can't contain emoji.` : null
}

/** Same check across a `stages` payload's names, or `null` when all are clean. */
export function stageNamesEmojiError(stages: unknown): string | null {
  if (!Array.isArray(stages)) return null
  return stages.some((s) => hasEmoji((s as { name?: unknown } | null)?.name))
    ? "Stage names can't contain emoji or invisible characters."
    : null
}

/**
 * The invisible characters stripped from EVERY text field (browser guard +
 * server body reader). Same as INVISIBLE minus the zero-width joiners
 * U+200C/U+200D: those hold multi-part emoji together (👨‍👩‍👧), and emoji
 * are allowed in free text like notes and chatbot messages. Name and label
 * fields still strip them through their own stricter rules.
 */
const GENERIC_INVISIBLE = /[ᅟᅠㅤﾠ⠀​‎‏⁠-⁤﻿­͏]/g

/** Removes generic invisible characters (see GENERIC_INVISIBLE). Doesn't trim. */
export function stripInvisibleGeneric(raw: string): string {
  return raw.replace(GENERIC_INVISIBLE, "")
}

/**
 * Cleans every string in a parsed JSON body — nested objects and arrays too —
 * except values under `skipKeys` (passwords, verification codes), which must
 * reach the server exactly as typed. Numbers, booleans and null pass through.
 */
export function stripInvisibleDeep<T>(value: T, { skipKeys = [] as readonly string[] } = {}): T {
  const skip = new Set(skipKeys)
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return stripInvisibleGeneric(v)
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, skip.has(k) ? val : walk(val)]),
      )
    }
    return v
  }
  return walk(value) as T
}

/**
 * For the browser guard: the cleaned value plus where the caret should go,
 * shifted left by however many characters were removed before it.
 */
export function cleanValueAndCaret(value: string, caret: number | null): { value: string; caret: number | null } {
  const clean = stripInvisibleGeneric(value)
  if (clean === value || caret === null) return { value: clean, caret }
  const removedBefore = value.slice(0, caret).length - stripInvisibleGeneric(value.slice(0, caret)).length
  return { value: clean, caret: caret - removedBefore }
}
