"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./Button"

function useLockedBody(open: boolean) {
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
}

function useEscape(open: boolean, onClose?: () => void) {
  React.useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])
}

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

type Size = "sm" | "md" | "lg" | "xl"
const SIZE: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
}

export interface ModalProps {
  open: boolean
  onClose?: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  size?: Size
  /** hide the header row entirely (custom content owns the layout) */
  bare?: boolean
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  bare,
  footer,
  children,
  className,
}: ModalProps) {
  useLockedBody(open)
  useEscape(open, onClose)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-shell/50 backdrop-blur-[2px]"
          onClick={onClose}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className={cn(
            "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-card bg-surface shadow-pop outline-none",
            SIZE[size],
            className,
          )}
        >
          {!bare && (title || onClose) && (
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

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  loading,
  icon: Icon,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: React.ReactNode
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: "primary" | "danger"
  loading?: boolean
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      size="sm"
      bare
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        {Icon && (
          <span
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full",
              tone === "danger" ? "bg-status-delayed/12 text-status-delayed" : "bg-primary/12 text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
        <h2 className="text-base font-semibold text-heading">{title}</h2>
        {message && <p className="text-sm text-body">{message}</p>}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={loading}>
          {loading ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
