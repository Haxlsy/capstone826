/**
 * Which teams a job order needs assigned, from the stages it will run.
 * A stage's category carries who does it (`workflow_category.technician_role`,
 * exposed on stages as `category_role`), so a service made only of installer
 * stages shouldn't force Operations to pick a detailer team that has no work.
 */
export interface TeamNeeds {
  detailer: boolean
  installer: boolean
}

export interface TeamSelection {
  headDetailerId: string | null
  headInstallerId: string | null
  detailerCount: number
  installerCount: number
}

export interface TeamErrors {
  headDetailer?: string
  headInstaller?: string
  detailers?: string
  installers?: string
}

const BOTH: TeamNeeds = { detailer: true, installer: true }

/**
 * Only relaxes the old "everyone is required" rule when it is certain: no
 * stages (not chosen yet, still loading, or unavailable offline) or any stage
 * with an unrecognised role keeps both teams required.
 */
export function requiredTeamRoles(
  stages: { category_role?: string | null }[],
): TeamNeeds {
  if (stages.length === 0) return BOTH
  let detailer = false
  let installer = false
  for (const s of stages) {
    if (s.category_role === "detailer") detailer = true
    else if (s.category_role === "installer") installer = true
    else return BOTH
  }
  return { detailer, installer }
}

/** Field errors for the team card — only for the teams the job needs. */
export function teamAssignmentErrors(needs: TeamNeeds, sel: TeamSelection): TeamErrors {
  const errs: TeamErrors = {}
  if (needs.detailer) {
    if (!sel.headDetailerId) errs.headDetailer = "Please select a Head Detailer."
    if (sel.detailerCount === 0) errs.detailers = "Please assign at least one Detailer."
  }
  if (needs.installer) {
    if (!sel.headInstallerId) errs.headInstaller = "Please select a Head Installer."
    if (sel.installerCount === 0) errs.installers = "Please assign at least one Installer."
  }
  return errs
}

/** One line under the "Team Assignment" heading. */
export function teamAssignmentHint(needs: TeamNeeds): string {
  if (needs.detailer && needs.installer) return "All team fields are required."
  if (needs.installer) return "This service only has installer stages — assign the installer team."
  return "This service only has detailer stages — assign the detailer team."
}
