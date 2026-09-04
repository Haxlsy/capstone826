import * as React from "react"
import { cn } from "@/lib/utils"

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle"
type Size = "sm" | "md" | "lg"

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover shadow-card disabled:bg-primary/50",
  secondary:
    "bg-primary-soft text-primary hover:bg-primary/20 disabled:opacity-50",
  subtle:
    "bg-surface-muted text-body hover:bg-border/60 disabled:opacity-50",
  ghost:
    "bg-transparent text-body hover:bg-surface-muted hover:text-heading disabled:opacity-50",
  danger:
    "bg-status-delayed text-white hover:brightness-95 disabled:opacity-50",
}

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** render as an inline-flex anchor-like element (used with asChild patterns) */
  fullWidth?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", fullWidth, className, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center rounded-pill font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = "Button"

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  "aria-label": string
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = "ghost", size = "md", className, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-10 w-10",
        className,
      )}
      {...props}
    />
  ),
)
IconButton.displayName = "IconButton"
