/**
 * Workflow-category swatch colours (Zendesk-style multi-hue labels).
 *
 * The colour NAME is persisted in the DB (`workflow_category.category_color`,
 * `category_color` on stages), so the keys here must stay stable. This module is
 * the single definition — replaces COLOR_STYLES/COLOR_OPTIONS
 * (ServiceManagement/service-form-helpers), COLOR_BADGE (JobOrderConfirmDialog)
 * and KB_CATEGORY_COLORS usage.
 *
 * Full class strings so Tailwind picks them up.
 */

export interface CategorySwatch {
  /** small pill / badge */
  badge: string
  /** left-border accent for grouped stage lists */
  accent: string
  /** solid dot */
  dot: string
  /** selectable swatch button base colour */
  swatch: string
}

export const CATEGORY_COLORS: Record<string, CategorySwatch> = {
  blue: {
    badge: "bg-blue-50 text-blue-700",
    accent: "border-blue-400",
    dot: "bg-blue-500",
    swatch: "bg-blue-500",
  },
  purple: {
    badge: "bg-purple-50 text-purple-700",
    accent: "border-purple-400",
    dot: "bg-purple-500",
    swatch: "bg-purple-500",
  },
  emerald: {
    badge: "bg-emerald-50 text-emerald-700",
    accent: "border-emerald-400",
    dot: "bg-emerald-500",
    swatch: "bg-emerald-500",
  },
  orange: {
    badge: "bg-orange-50 text-orange-700",
    accent: "border-orange-400",
    dot: "bg-orange-500",
    swatch: "bg-orange-500",
  },
  rose: {
    badge: "bg-rose-50 text-rose-700",
    accent: "border-rose-400",
    dot: "bg-rose-500",
    swatch: "bg-rose-500",
  },
  teal: {
    badge: "bg-teal-50 text-teal-700",
    accent: "border-teal-400",
    dot: "bg-teal-500",
    swatch: "bg-teal-500",
  },
  yellow: {
    badge: "bg-yellow-50 text-yellow-700",
    accent: "border-yellow-400",
    dot: "bg-yellow-500",
    swatch: "bg-yellow-500",
  },
}

export const CATEGORY_COLOR_NAMES = Object.keys(CATEGORY_COLORS)

export function categorySwatch(color: string | null | undefined): CategorySwatch {
  return CATEGORY_COLORS[color ?? "blue"] ?? CATEGORY_COLORS.blue
}
