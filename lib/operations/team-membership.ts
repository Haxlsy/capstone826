/**
 * Whether a person is already on a job — as an assigned (primary) member or
 * as a substitute — so the "Add Substitute" list can show why they can't be
 * picked (and, for a substitute, offer to remove them) instead of letting the
 * server reject it. `primaryId` covers a head role's single assignee;
 * `primaryIds` covers crew (detailer/installer), which can have several.
 */
export function alreadyOnJob(
  personId: string,
  team: { primaryId?: string | null; primaryIds?: string[]; substituteIds?: string[] },
): "primary" | "substitute" | null {
  if (team.primaryId && team.primaryId === personId) return "primary"
  if (team.primaryIds?.includes(personId)) return "primary"
  if (team.substituteIds?.includes(personId)) return "substitute"
  return null
}
