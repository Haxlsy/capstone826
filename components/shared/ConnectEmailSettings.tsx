"use client"

import { useEffect, useState } from "react"
import { Mail, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { ConfirmModal } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"
import { validateEmail } from "@/lib/email/validation"

type Step = "idle" | "editing" | "verifying"

/**
 * Self-service "connect my email for MFA" — the prerequisite baseline that
 * TwoFactorAuthSettings.tsx's TOTP upgrade sits on top of. Verify-then-save:
 * nothing is written to the account until the emailed code is confirmed
 * (app/api/auth/connect-email/start+confirm), same principle as TOTP
 * enrollment never activating until its own confirmation code checks out.
 */
export default function ConnectEmailSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)

  const [step, setStep] = useState<Step>("idle")
  const [emailInput, setEmailInput] = useState("")
  const [emailError, setEmailError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [starting, setStarting] = useState(false)

  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState("")
  const [verifying, setVerifying] = useState(false)

  async function loadProfile() {
    try {
      const res = await fetch("/api/auth/me")
      const json = await res.json()
      setConnectedEmail(json.user?.email ?? null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  function startEditing() {
    setEmailInput(connectedEmail ?? "")
    setEmailError("")
    setStep("editing")
  }

  function cancelEditing() {
    setStep("idle")
    setEmailInput("")
    setEmailError("")
  }

  function handleSaveClick(e: React.FormEvent) {
    e.preventDefault()
    const err = validateEmail(emailInput, "Email")
    if (err) {
      setEmailError(err)
      return
    }
    setEmailError("")
    setConfirmOpen(true)
  }

  async function confirmStart() {
    setStarting(true)
    try {
      const res = await fetch("/api/auth/connect-email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setConfirmOpen(false)
        setEmailError(json.error ?? "Something went wrong.")
        setStep("editing")
        return
      }
      setChallengeId(json.challengeId)
      setCode("")
      setCodeError("")
      setConfirmOpen(false)
      setStep("verifying")
    } catch {
      setConfirmOpen(false)
      setEmailError("Network error. Please try again.")
    } finally {
      setStarting(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) {
      setCodeError("Enter the 6-digit code.")
      return
    }
    setCodeError("")
    setVerifying(true)
    try {
      const res = await fetch("/api/auth/connect-email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code: code.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCodeError(json.error ?? "Incorrect code. Please try again.")
        return
      }
      toast.success("Email connected for MFA.")
      setConnectedEmail(json.email)
      setStep("idle")
      setChallengeId(null)
      setCode("")
    } catch {
      setCodeError("Network error. Please try again.")
    } finally {
      setVerifying(false)
    }
  }

  function cancelVerify() {
    setStep("idle")
    setChallengeId(null)
    setCode("")
    setCodeError("")
  }

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden mt-6">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
          <Mail className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-heading">Email for Verification</p>
          <p className="text-xs text-muted">Used for login verification codes and account notices.</p>
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : step === "editing" ? (
          <form onSubmit={handleSaveClick} className="space-y-3">
            <input
              type="email"
              autoFocus
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value)
                if (emailError) setEmailError("")
              }}
              placeholder="e.g. juan.delacruz@gmail.com"
              className={`w-full px-3 py-2.5 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                emailError ? "border-status-delayed bg-status-delayed/10" : "border-border"
              }`}
            />
            {emailError && <p className="text-xs text-status-delayed">{emailError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit">Save</Button>
              <Button type="button" variant="ghost" onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </form>
        ) : step === "verifying" ? (
          <form onSubmit={handleVerify} className="space-y-3">
            <p className="text-sm text-body">
              We sent a code to <span className="font-medium text-heading">{emailInput}</span> to confirm it
              works.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                if (codeError) setCodeError("")
              }}
              placeholder="123456"
              className={`w-full px-3 py-2.5 text-center text-lg tracking-[0.3em] border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                codeError ? "border-status-delayed bg-status-delayed/10" : "border-border"
              }`}
            />
            {codeError && <p className="text-xs text-status-delayed">{codeError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={verifying}>
                {verifying ? "Verifying…" : "Confirm"}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelVerify} disabled={verifying}>
                Cancel
              </Button>
            </div>
          </form>
        ) : connectedEmail ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-body">
              Connected: <span className="font-medium text-heading">{connectedEmail}</span>
            </p>
            <Button variant="secondary" size="sm" onClick={startEditing}>
              Update
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-body">Not connected yet.</p>
            <Button onClick={startEditing}>
              <Mail className="w-3.5 h-3.5" /> Add Email for MFA
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => !starting && setConfirmOpen(false)}
        onConfirm={confirmStart}
        title="Add this email for verification?"
        message={`We'll send a code to ${emailInput.trim()} to confirm it works before it's connected.`}
        confirmLabel={starting ? "Sending…" : "Send Code"}
        loading={starting}
        icon={ShieldCheck}
      />
    </div>
  )
}
