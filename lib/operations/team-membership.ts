/**
 * Whether a person is already on a job in the given head role — as the
 * assigned (primary) head or as a substitute — so the "Add Substitute" list
 * can show why they can't be picked instead of letting the server reject it.
 */
export function alreadyOnJob(
  personId: string,
  team: { primaryId?: string | null; substituteIds?: string[] },
): "primary" | "substitute" | null {
  if (team.primaryId && team.primaryId === personId) return "primary"
  if (team.substituteIds?.includes(personId)) return "substitute"
  return null
}
