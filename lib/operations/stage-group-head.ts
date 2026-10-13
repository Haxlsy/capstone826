/**
 * Who is responsible for a group of stages on a job order: the head
 * technician whose team owns the group's workflow category, plus any
 * substitute head technicians for that role. Pure, so the Operations job
 * detail can label each stage group without its own role lookup.
 */

interface Person {
  full_name: string
}

export interface JobHeads {
  head_detailer: Person | null
  head_installer: Person | null
  head_detailer_substitutes: Person[]
  head_installer_substitutes: Person[]
}

export interface StageGroupHead {
  /** "Head Detailer" or "Head Installer". */
  label: string
  /** The assigned head's name, or "Unassigned". */
  name: string
  assigned: boolean
  /** Substitute head technicians for this role, in the order they were added. */
  substitutes: string[]
}

/**
 * Returns null for a group with no role (a stage whose category could not be
 * resolved), so no name is shown where the owner is not actually known.
 */
export function stageGroupHead(
  role: "detailer" | "installer" | null | undefined,
  heads: JobHeads,
): StageGroupHead | null {
  if (role !== "detailer" && role !== "installer") return null
  const head = role === "installer" ? heads.head_installer : heads.head_detailer
  const subs = role === "installer" ? heads.head_installer_substitutes : heads.head_detailer_substitutes
  return {
    label: role === "installer" ? "Head Installer" : "Head Detailer",
    name: head?.full_name ?? "Unassigned",
    assigned: Boolean(head),
    substitutes: subs.map((s) => s.full_name),
  }
}
