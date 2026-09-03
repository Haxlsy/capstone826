import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone =
  | "pending" | "ongoing" | "rework" | "inspection" | "release"
  | "delayed" | "concern" | "onjob" | "total"

const TONE: Record<Tone, { solid: string; accent: string; chip: string; text: string }> = {
  pending:    { solid: "bg-status-pending",    accent: "border-l-status-pending",    chip: "bg-status-pending/15 text-status-pending",       text: "text-status-pending" },
  ongoing:    { solid: "bg-status-ongoing",    accent: "border-l-status-ongoing",    chip: "bg-status-ongoing/15 text-status-ongoing",       text: "text-status-ongoing" },
  rework:     { solid: "bg-status-rework",     accent: "border-l-status-rework",     chip: "bg-status-rework/15 text-status-rework",         text: "text-status-rework" },
  inspection: { solid: "bg-status-inspection", accent: "border-l-status-inspection", chip: "bg-status-inspection/15 text-status-inspection", text: "text-status-inspection" },
  release:    { solid: "bg-status-release",    accent: "border-l-status-release",    chip: "bg-status-release/15 text-status-release",       text: "text-status-release" },
  delayed:    { solid: "bg-status-delayed",    accent: "border-l-status-delayed",    chip: "bg-status-delayed/15 text-status-delayed",       text: "text-status-delayed" },
  concern:    { solid: "bg-status-concern",    accent: "border-l-status-concern",    chip: "bg-status-concern/15 text-status-concern",       text: "text-status-concern" },
  onjob:      { solid: "bg-status-onjob",      accent: "border-l-status-onjob",      chip: "bg-status-onjob/15 text-status-onjob",           text: "text-status-onjob" },
  total:      { solid: "bg-status-total",      accent: "border-l-status-total",      chip: "bg-status-total/15 text-status-total",           text: "text-status-total" },
}

/**
 * Colored summary card — icon badge, label, large number.
 * `variant="solid"` matches the Technician Availability mockup (filled card);
 * `variant="soft"` matches the Operations dashboard mockup (white card, accent).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "total",
  variant = "soft",
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
  const t = TONE[tone]
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 rounded-card p-4 text-left transition-shadow",
        variant === "solid"
          ? cn(t.solid, "text-white shadow-card")
          : cn("border border-border-subtle border-l-4 bg-surface shadow-card", t.accent),
        onClick && "cursor-pointer hover:shadow-pop",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-sm",
            variant === "solid" ? "bg-white/20 text-white" : t.chip,
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      )}
      <div>
        <p className={cn("text-2xl font-bold leading-none", variant === "solid" ? "text-white" : t.text)}>
          {value}
        </p>
        <p className={cn("mt-1.5 text-xs font-medium", variant === "solid" ? "text-white/80" : "text-body")}>
          {label}
        </p>
      </div>
    </Comp>
  )
}
