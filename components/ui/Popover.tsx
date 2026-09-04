"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Lightweight anchored popover: a trigger + a panel that closes on
 * outside-click / Escape. Used for filter menus, row ⋯-action menus,
 * and search-combobox dropdowns.
 */
export function Popover({
  trigger,
  children,
  align = "start",
  panelClassName,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
  align?: "start" | "end"
  panelClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolled, setUncontrolled] = React.useState(false)
  const open = controlledOpen ?? uncontrolled
  const setOpen = (next: boolean) => {
    onOpenChange?.(next)
    if (controlledOpen === undefined) setUncontrolled(next)
  }
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 min-w-[12rem] rounded-card border border-border-subtle bg-surface p-1.5 shadow-pop",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  className,
  icon: Icon,
  danger,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ComponentType<{ className?: string }>
  danger?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm transition-colors",
        danger
          ? "text-status-delayed hover:bg-status-delayed/10"
          : "text-body hover:bg-surface-muted hover:text-heading",
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {props.children}
    </button>
  )
}
