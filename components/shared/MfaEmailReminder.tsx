"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ShieldAlert } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"

/**
 * Dismissible "you have no MFA set up" nudge — shown once per fresh login
 * (not on every page load/navigation) while the account has no email on
 * file, since login gracefully skips MFA in that case (see
 * app/api/auth/login/route.ts). Reads+strips the one-shot ?justLoggedIn=1
 * query param LoginPage.tsx's finishLogin() adds, same technique
 * SessionEnforcement.tsx already uses for its own one-shot param. Renders
 * nothing when dismissed or when there's nothing to remind about.
 */
export function MfaEmailReminder() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const justLoggedIn = new URLSearchParams(window.location.search).get("justLoggedIn") === "1"
    if (!justLoggedIn) return

    const url = new URL(window.location.href)
    url.searchParams.delete("justLoggedIn")
    router.replace(url.pathname + url.search)

    try {
      const raw = localStorage.getItem("826_user")
      const user = raw ? JSON.parse(raw) : null
      if (user && !user.email) setOpen(true)
    } catch {
      /* ignore */
    }
    // Only ever meant to fire once, right after the query param that
    // triggered it — not on every navigation this component re-renders for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function goToSettings() {
    setOpen(false)
    if (pathname?.startsWith("/head-technician")) {
      router.push("/head-technician/settings")
    } else {
      // Admin/Operations/Sales render Settings as a modal inside
      // AppSidebar.tsx, not a route — ask it to open itself rather than
      // threading new shared state through the shell tree for one trigger.
      window.dispatchEvent(new CustomEvent("826:open-settings"))
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Set up extra login security"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Remind Me Later
          </Button>
          <Button onClick={goToSettings}>Set Up Now</Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 shrink-0 text-status-warning mt-0.5" />
        <p className="text-sm text-body">
          Your account doesn&apos;t have an email connected yet, so login verification codes aren&apos;t active.
          Add one from Settings to turn on extra login security for your account.
        </p>
      </div>
    </Modal>
  )
}
