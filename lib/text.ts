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

/** Hint shown when `stripEmoji` drops something the user typed. */
export const EMOJI_BLOCKED_MESSAGE = "Emoji aren't allowed here."

/** Removes emoji as the user types or pastes. Doesn't trim. */
export function stripEmoji(raw: string): string {
  return raw.replace(EMOJI, "")
}

/** True when a value is a string containing any emoji (for server checks). */
export function hasEmoji(raw: unknown): boolean {
  return typeof raw === "string" && stripEmoji(raw) !== raw
}

/** 400-ready message for a field that contains emoji, or `null` when clean. */
export function emojiError(raw: unknown, label: string): string | null {
  return hasEmoji(raw) ? `${label} can't contain emoji.` : null
}

/** Same check across a `stages` payload's names, or `null` when all are clean. */
export function stageNamesEmojiError(stages: unknown): string | null {
  if (!Array.isArray(stages)) return null
  return stages.some((s) => hasEmoji((s as { name?: unknown } | null)?.name))
    ? "Stage names can't contain emoji."
    : null
}
