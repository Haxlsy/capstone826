"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"

/**
 * The single logout routine — previously copy-pasted into every sidebar and
 * the head-technician BottomNav.
 */
export function useLogout() {
  const router = useRouter()
  return useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem("826_user")
    } catch {
      /* ignore */
    }
    router.push("/")
  }, [router])
}
