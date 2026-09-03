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
