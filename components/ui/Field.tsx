import * as React from "react"
import { cn } from "@/lib/utils"

const baseControl =
  "w-full rounded-sm border border-border bg-surface text-sm text-heading transition-colors " +
  "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  /** leading icon element (rendered absolutely) */
  icon?: React.ReactNode
  pill?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, icon, pill, ...props }, ref) => {
    const control = (
      <input
        ref={ref}
        className={cn(
          baseControl,
          pill ? "rounded-pill" : "rounded-sm",
          "h-10 px-3",
          icon && "pl-9",
          invalid && "border-status-delayed focus:ring-status-delayed/30 focus:border-status-delayed",
          className,
        )}
        {...props}
      />
    )
    if (!icon) return control
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        {control}
      </div>
    )
  },
)
Input.displayName = "Input"

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      baseControl,
      "rounded-sm px-3 py-2 leading-relaxed resize-y",
      invalid && "border-status-delayed focus:ring-status-delayed/30 focus:border-status-delayed",
      className,
    )}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; pill?: boolean }
>(({ className, invalid, pill, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      baseControl,
      pill ? "rounded-pill" : "rounded-sm",
      "h-10 px-3 pr-8 appearance-none bg-no-repeat",
      "bg-[length:1rem] bg-[position:right_0.6rem_center]",
      invalid && "border-status-delayed focus:ring-status-delayed/30 focus:border-status-delayed",
      className,
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
    }}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = "Select"

export function FieldLabel({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-xs font-semibold text-body mb-1.5", className)}
      {...props}
    >
      {children}
    </label>
  )
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return <p className="mt-1 text-xs text-status-delayed">{children}</p>
}

const HOUR_MINUTE_SIZES = {
  // Admin's Add/Edit Service + Category Presets stage rows.
  md: { box: "w-14 px-1.5 py-2 text-xs", colon: "text-xs font-medium", caption: "text-[9px]" },
  // Operations' denser Service Override panel (Add Job Order).
  sm: { box: "w-11 px-1 py-0.5 text-[10px]", colon: "text-[10px]", caption: "text-[8px]" },
} as const

/**
 * Hour/minute duration pair (two number boxes joined by ":") with a small
 * "HH : MM" caption — every stage-duration input in the app was this same
 * pair with no visible unit hint (hours vs. minutes was genuinely ambiguous
 * at a glance), so this is the one place that combination is defined now.
 * Mirrors the caption already used next to the read-only *total* duration in
 * the same forms, just applied to the editable per-stage boxes too.
 */
export function HourMinuteInput({
  hours,
  minutes,
  onChange,
  ariaLabelPrefix,
  invalid,
  size = "md",
  className,
}: {
  hours: number
  minutes: number
  onChange: (hours: number, minutes: number) => void
  /** e.g. "Stage 1" — produces aria-labels "Stage 1 hours" / "Stage 1 minutes" */
  ariaLabelPrefix?: string
  invalid?: boolean
  size?: "sm" | "md"
  className?: string
}) {
  const s = HOUR_MINUTE_SIZES[size]
  const labelPrefix = ariaLabelPrefix ? `${ariaLabelPrefix} ` : ""
  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-0.5", className)}>
      <div
        className={cn(
          "flex items-center overflow-hidden rounded-sm border transition-colors",
          invalid ? "border-status-delayed bg-status-delayed/10" : "border-border",
        )}
      >
        <input
          type="number"
          min={0}
          value={hours}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0), minutes)}
          aria-label={`${labelPrefix}hours`}
          placeholder="00"
          className={cn("bg-transparent text-center focus:outline-none", s.box)}
        />
        <span className={cn("text-muted", s.colon)}>:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={minutes}
          onChange={(e) => onChange(hours, Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
          aria-label={`${labelPrefix}minutes`}
          placeholder="00"
          className={cn("bg-transparent text-center focus:outline-none", s.box)}
        />
      </div>
      <span className={cn("leading-none text-muted", s.caption)}>HH : MM</span>
    </div>
  )
}
