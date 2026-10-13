export type TeamRole = "detailer" | "installer"

/** The team a Head Technician leads. Anything but head_installer is the detailer side. */
export function teamOfHead(headRole: string | null | undefined): TeamRole {
  return headRole === "head_installer" ? "installer" : "detailer"
}

/**
 * The team that owns a stage, from its workflow category's `technician_role`.
 * A stage with no category counts as the detailer team's, matching how the
 * job detail GET groups stages.
 */
export function stageOwnerTeam(categoryRole: string | null | undefined): TeamRole {
  return categoryRole === "installer" ? "installer" : "detailer"
}

/**
 * A Head Technician may only send back their OWN team's stages. Sending
 * another team's work back is Operations' call (stage-rework route), not the
 * other head's. Returns the ids the caller may not flag; empty means allowed.
 */
export function stagesNotOwnedBy(
  headRole: string | null | undefined,
  stages: { id: string; categoryRole: string | null | undefined }[],
): string[] {
  const team = teamOfHead(headRole)
  return stages.filter((s) => stageOwnerTeam(s.categoryRole) !== team).map((s) => s.id)
}
