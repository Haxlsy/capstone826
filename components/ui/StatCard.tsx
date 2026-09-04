import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone =
  | "pending" | "ongoing" | "rework" | "inspection" | "release"
  | "delayed" | "concern" | "onjob" | "total"

const SOLID: Record<Tone, string> = {
  pending: "bg-status-pending",
  ongoing: "bg-status-ongoing",
  rework: "bg-status-rework",
  inspection: "bg-status-inspection",
  release: "bg-status-release",
  delayed: "bg-status-delayed",
  concern: "bg-status-concern",
  onjob: "bg-status-onjob",
  total: "bg-status-total",
}

const SOFT: Record<Tone, { accent: string; chip: string; text: string }> = {
  pending:    { accent: "border-l-status-pending",    chip: "bg-status-pending/15 text-status-pending",       text: "text-status-pending" },
  ongoing:    { accent: "border-l-status-ongoing",    chip: "bg-status-ongoing/15 text-status-ongoing",       text: "text-status-ongoing" },
  rework:     { accent: "border-l-status-rework",     chip: "bg-status-rework/15 text-status-rework",         text: "text-status-rework" },
  inspection: { accent: "border-l-status-inspection", chip: "bg-status-inspection/15 text-status-inspection", text: "text-status-inspection" },
  release:    { accent: "border-l-status-release",    chip: "bg-status-release/15 text-status-release",       text: "text-status-release" },
  delayed:    { accent: "border-l-status-delayed",    chip: "bg-status-delayed/15 text-status-delayed",       text: "text-status-delayed" },
  concern:    { accent: "border-l-status-concern",    chip: "bg-status-concern/15 text-status-concern",       text: "text-status-concern" },
  onjob:      { accent: "border-l-status-onjob",      chip: "bg-status-onjob/15 text-status-onjob",           text: "text-status-onjob" },
  total:      { accent: "border-l-status-total",      chip: "bg-status-total/15 text-status-total",           text: "text-status-total" },
}

/**
 * Coloured summary card. `solid` (default) is the filled card from the reference
 * mockups: small icon + label on top, big number below, one flat status colour.
 * `soft` keeps a white card with a left accent (used where a filled card would
 * be visually heavy).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "total",
  variant = "solid",
  onClick,
  className,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  variant?: "soft" | "solid"
  onClick?: () => void
  className?: string
}) {
  const Comp = onClick ? "button" : "div"

  if (variant === "solid") {
    return (
      <Comp
        onClick={onClick}
        className={cn(
          "flex flex-col gap-2.5 rounded-card p-4 text-left text-white shadow-card transition-shadow",
          SOLID[tone],
          onClick && "cursor-pointer hover:shadow-pop",
          className,
        )}
      >
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-white/95">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />}
          {label}
        </span>
        <span className="text-[28px] font-bold leading-none">{value}</span>
      </Comp>
    )
  }

  const s = SOFT[tone]
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 rounded-card border border-border-subtle border-l-4 bg-surface p-4 text-left shadow-card transition-shadow",
        s.accent,
        onClick && "cursor-pointer hover:shadow-pop",
        className,
      )}
    >
      {Icon && (
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-sm", s.chip)}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      )}
      <div>
        <p className={cn("text-2xl font-bold leading-none", s.text)}>{value}</p>
        <p className="mt-1.5 text-xs font-medium text-body">{label}</p>
      </div>
    </Comp>
  )
}
