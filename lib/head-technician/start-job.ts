/**
 * Who may start a job. A job is started by the head technician whose team owns
 * its FIRST stage (by sequence). Detailer-first jobs behave as they always have
 * (the Head Detailer starts); an installer-only or installer-first job is
 * started by the Head Installer — previously only a Head Detailer could start
 * anything, so an installer-only job could never leave Pending.
 */
export type HeadRole = "head_detailer" | "head_installer"

export interface StageRole {
  /** workflow_category.technician_role of the stage's category. */
  role: string | null | undefined
  sequence: number
}

export function startRoleFor(stages: StageRole[]): HeadRole {
  const first = [...stages]
    .filter((s) => Number.isFinite(s.sequence))
    .sort((a, b) => a.sequence - b.sequence)[0]
  // No stages / unrecognised role → the long-standing default.
  return first?.role === "installer" ? "head_installer" : "head_detailer"
}

export function canStartJob(callerRole: string | null | undefined, stages: StageRole[]): boolean {
  return callerRole === startRoleFor(stages)
}

/** "Head Detailer" / "Head Installer" for UI copy. */
export function headRoleLabel(role: HeadRole): string {
  return role === "head_installer" ? "Head Installer" : "Head Detailer"
}
