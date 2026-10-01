/**
 * Shared duplicate-stage-name rule for every place a user builds a list of
 * workflow stages — Category Presets, and Add/Edit Service (both client-side,
 * for immediate feedback, and server-side, as the authoritative check against
 * a direct API call). Before this existed, none of them rejected two stages
 * named identically; only an empty name was ever caught.
 *
 * Two names collide when they're the same after trimming and lower-casing —
 * exact duplicates and ones that only differ by case or surrounding
 * whitespace both count. An empty name is never a "duplicate" of another
 * empty name — that's already its own "name is required" error.
 */
export interface NamedStage {
  id: string
  name: string
}

const normalize = (name: string) => name.trim().toLowerCase()

/** Ids of every stage whose normalized name collides with an EARLIER stage in the list. */
export function findDuplicateStageIds(stages: NamedStage[]): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const stage of stages) {
    const key = normalize(stage.name)
    if (!key) continue
    if (seen.has(key)) duplicates.add(stage.id)
    else seen.add(key)
  }
  return duplicates
}

/** The first duplicated stage name (trimmed, original casing), or null if there are none. */
export function findDuplicateStageName(stages: { name: string }[]): string | null {
  const seen = new Set<string>()
  for (const stage of stages) {
    const key = normalize(stage.name)
    if (!key) continue
    if (seen.has(key)) return stage.name.trim()
    seen.add(key)
  }
  return null
}
