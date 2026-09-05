"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastTone = "success" | "error" | "info"

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

const TONE: Record<ToastTone, { icon: React.ComponentType<{ className?: string }>; accent: string }> = {
  success: { icon: CheckCircle2, accent: "text-status-inspection" },
  error: { icon: AlertCircle, accent: "text-status-delayed" },
  info: { icon: Info, accent: "text-primary" },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = React.useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = Date.now() + Math.random()
      setItems((prev) => [...prev, { id, tone, message }])
      setTimeout(() => remove(id), 4000)
    },
    [remove],
  )

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
      info: (m) => push(m, "info"),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
            {items.map((t) => {
              const { icon: Icon, accent } = TONE[t.tone]
              return (
                <div
                  key={t.id}
                  role="status"
                  className="pointer-events-auto flex items-start gap-3 rounded-card border border-border-subtle bg-surface p-3.5 shadow-pop"
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", accent)} />
                  <p className="flex-1 text-sm text-heading">{t.message}</p>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => remove(t.id)}
                    className="-mr-1 -mt-1 rounded-full p-1 text-muted hover:text-body"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

// Safe no-op fallback so a stray call never crashes a page. Module-level, not
// built per call: callers put `toast` in dependency arrays, and a fresh object
// each render would make every such dependency unstable.
const NOOP_TOAST: ToastContextValue = {
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
}

export function useToast(): ToastContextValue {
  return React.useContext(ToastContext) ?? NOOP_TOAST
}
