/**
 * Single source of truth for role → label + badge styling.
 * Replaces the three drifted ROLE_BADGE maps (AccountTable,
 * AdminSide/Constants/config.tsx, OperationComponents/TechnicianAvailability).
 * Full class strings — token colours only.
 */

export interface RoleStyle {
  label: string
  badge: string
}

const TABLE: Record<string, RoleStyle> = {
  super_admin: { label: "Super Admin", badge: "bg-status-concern/12 text-status-concern" },
  admin: { label: "Admin", badge: "bg-status-ongoing/12 text-status-ongoing" },
  operations: { label: "Operations", badge: "bg-primary/12 text-primary" },
  sales: { label: "Sales", badge: "bg-status-pending/12 text-status-pending" },
  head_detailer: { label: "Head Detailer", badge: "bg-status-inspection/12 text-status-inspection" },
  head_installer: { label: "Head Installer", badge: "bg-status-release/12 text-status-release" },
  detailer: { label: "Detailer", badge: "bg-status-inspection/12 text-status-inspection" },
  installer: { label: "Installer", badge: "bg-status-release/12 text-status-release" },
  head_technician: { label: "Head Technician", badge: "bg-status-release/12 text-status-release" },
}

const FALLBACK: RoleStyle = { label: "—", badge: "bg-status-total/12 text-status-total" }

export function roleStyle(role: string | null | undefined): RoleStyle {
  if (!role) return FALLBACK
  return TABLE[role.toLowerCase().trim()] ?? { label: role, badge: FALLBACK.badge }
}

export function roleLabel(role: string | null | undefined): string {
  return roleStyle(role).label
}
