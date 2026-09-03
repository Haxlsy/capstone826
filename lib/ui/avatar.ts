/**
 * Deterministic avatar colour + initials.
 * Replaces AVATAR_COLORS (TechnicianAvailability) and the `avatarColor`
 * palettes duplicated in JobConcerns / SalesConcerns.
 * Full class strings — token colours only.
 */

const PALETTE = [
  "bg-status-ongoing text-white",
  "bg-status-inspection text-white",
  "bg-status-pending text-white",
  "bg-status-concern text-white",
  "bg-status-release text-white",
  "bg-status-delayed text-white",
  "bg-primary text-white",
  "bg-status-total text-white",
] as const

export function avatarColor(name: string): string {
  if (!name) return PALETTE[PALETTE.length - 1]
  const sum = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return PALETTE[sum % PALETTE.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
