"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSessionEnforcement } from "@/hooks/useSessionEnforcement"
import { useToast } from "@/components/ui/Toast"

/**
 * Enforces single active session per account, and shows a toast explaining
 * why the visitor landed here when it wasn't where they asked to go —
 * currently only the ?reason=forbidden_role redirect from
 * lib/auth/guard.ts's requireRole(). Reads window.location.search directly
 * (not useSearchParams()) so this doesn't need a Suspense boundary — same
 * technique LoginPage.tsx uses for its own one-time query param. Renders
 * nothing itself.
 */
export function SessionEnforcement() {
  useSessionEnforcement()

  const router = useRouter()
  const toast = useToast()
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  })

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason")
    if (reason !== "forbidden_role") return
    toastRef.current.error("You don't have access to that page — you've been returned to your dashboard.")
    const url = new URL(window.location.href)
    url.searchParams.delete("reason")
    router.replace(url.pathname + url.search)
  }, [router])

  return null
}
