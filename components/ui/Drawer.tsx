"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

type Width = "sm" | "md" | "lg"
const WIDTH: Record<Width, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
}

/**
 * Right-side slide-over. Always mounted while `open || closing` so the
 * transform transition plays in both directions.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  width = "md",
  footer,
  children,
  className,
}: {
  open: boolean
  onClose?: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  width?: Width
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.()
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  return (
    <Portal>
      <div
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-[100] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="absolute inset-0 bg-shell/40" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-pop transition-transform duration-300 ease-out",
            WIDTH[width],
            open ? "translate-x-0" : "translate-x-full",
            className,
          )}
        >
          {(title || onClose) && (
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
              <div>
                {title && <h2 className="text-base font-semibold text-heading">{title}</h2>}
                {description && <p className="mt-0.5 text-sm text-body">{description}</p>}
              </div>
              {onClose && (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="-mr-1 -mt-1 rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-body"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3.5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
