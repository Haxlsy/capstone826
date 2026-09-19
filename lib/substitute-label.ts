export type HeadRole = "head_detailer" | "head_installer"

/** "Substitute Head Detailer" / "Substitute Head Installer" — one wording for the
 *  Operations job page badge and the notification the substitute receives. */
export function substituteRoleLabel(role: HeadRole): string {
  return role === "head_detailer" ? "Substitute Head Detailer" : "Substitute Head Installer"
}

export function substituteAddedMessage(role: HeadRole, jobLabel: string): string {
  return `You've been added as ${substituteRoleLabel(role)} for job ${jobLabel}.`
}
