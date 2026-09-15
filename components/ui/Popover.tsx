"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

/**
 * Anchored popover: a trigger + a panel that closes on outside-click /
 * Escape. Used for filter menus, row ⋯-action menus, and search-combobox
 * dropdowns.
 *
 * The panel is rendered into a portal (document.body) and positioned from
 * the trigger's live bounding rect, rather than as a normal absolutely-
 * positioned DOM child. A plain child gets silently clipped by ANY ancestor
 * with `overflow` set — a scrollable table wrapper, a card, etc. — which is
 * exactly what was happening to every row-actions menu once its table
 * container needed `overflow-y-hidden` for an unrelated scrollbar fix. A
 * portal has no such ancestor to be clipped by.
 */
export function Popover({
  trigger,
  children,
  align = "start",
  panelClassName,
  open: controlledOpen,
  onOpenChange,
  matchTriggerWidth,
  placement = "auto",
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
  align?: "start" | "end"
  panelClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Sizes the panel to the trigger's own width instead of its default
   *  min-width — for search-combobox uses, where the dropdown should line
   *  up with the input above it rather than looking narrower/wider. */
  matchTriggerWidth?: boolean
  /** "auto" (default) flips above the trigger when there isn't room below —
   *  needed for row-action menus near the bottom of a table/viewport.
   *  "bottom" always opens below, never flips — for a search combobox where
   *  a inconsistent top/bottom placement reads as broken rather than smart. */
  placement?: "auto" | "bottom"
}) {
  const [uncontrolled, setUncontrolled] = React.useState(false)
  const open = controlledOpen ?? uncontrolled
  const setOpen = (next: boolean) => {
    onOpenChange?.(next)
    if (controlledOpen === undefined) setUncontrolled(next)
  }

  const triggerRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [coords, setCoords] = React.useState<{ top?: number; bottom?: number; left?: number; right?: number; width?: number } | null>(null)
  const [mounted, setMounted] = React.useState(false)

  // createPortal needs document.body, which doesn't exist during SSR.
  React.useEffect(() => setMounted(true), [])

  // Flips the panel above the trigger when there isn't room below (e.g. the
  // trigger is near the bottom of the viewport, as on a table's last row) —
  // measured off the panel's own real height, not a guess, so it only flips
  // when actually needed. The panel is rendered `visibility: hidden` until
  // `coords` is set (see below), so this first, unpositioned render is
  // invisible but still gives us a real element to measure.
  const updatePosition = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    let openAbove = false
    if (placement === "auto") {
      const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 0
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      openAbove = panelHeight > 0 && spaceBelow < panelHeight + 12 && spaceAbove > spaceBelow
    }

    setCoords({
      ...(openAbove ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      ...(align === "end" ? { right: window.innerWidth - rect.right } : { left: rect.left }),
      ...(matchTriggerWidth ? { width: rect.width } : {}),
    })
  }, [align, matchTriggerWidth, placement])

  React.useLayoutEffect(() => {
    if (open) updatePosition()
    else setCoords(null)
  }, [open, updatePosition])

  React.useEffect(() => {
    if (!open) return

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    // A fixed-position panel would otherwise visually detach from its trigger
    // as soon as an ANCESTOR scrolls (the table itself, or the page) —
    // closing on scroll is simpler and more robust than continuously
    // re-tracking the trigger's position. But scrolling *inside the panel
    // itself* (its own results list) must not close it — that scroll event
    // still reaches this capture-phase listener since it's on `window`.
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }

    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div className="relative" ref={triggerRef}>
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && mounted && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            visibility: coords ? "visible" : "hidden",
            top: coords?.top,
            bottom: coords?.bottom,
            left: coords?.left,
            right: coords?.right,
            width: coords?.width,
          }}
          className={cn(
            // Above every overlay in the app, including a Modal (z-[100]) and
            // the fullscreen MediaPreviewModal (z-[120]) — a popover opened
            // from inside either must never render behind them.
            "z-[150] min-w-[12rem] rounded-card border border-border-subtle bg-surface p-1.5 shadow-pop",
            panelClassName,
          )}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>,
        document.body,
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
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
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
