"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, QrCode, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { ConfirmModal } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"

interface EnrollState {
  factorId: string
  qrCodeUrl: string
  secret: string
}

/**
 * Optional TOTP upgrade — email-code MFA already works for every account
 * with no setup (see app/api/auth/login/route.ts). This lets a user enroll
 * an authenticator app as a faster alternative; login then prefers it but
 * still offers "use email instead" as a fallback. 
 */
export default function TwoFactorAuthSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null)

  const [enroll, setEnroll] = useState<EnrollState | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [code, setCode] = useState("")
  const [verifyError, setVerifyError] = useState("")
  const [verifying, setVerifying] = useState(false)

  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function loadFactors() {
    const supabase = createClient()
    const { data } = await supabase.auth.mfa.listFactors()
    setVerifiedFactorId(data?.totp?.[0]?.id ?? null)
    setLoading(false)
  }

  useEffect(() => {
    loadFactors()
  }, [])

  async function startEnroll() {
    setEnrolling(true)
    try {
      const supabase = createClient()

      // Supabase enforces a unique friendly_name per user, and enroll() below
      // defaults it to "". A factor left over from a prior abandoned attempt
      // (closed the browser mid-setup, or hit Cancel before it cleaned up
      // after itself) collides with that default and makes every future
      // enroll() fail with "A factor with the friendly name already exists" —
      // listFactors().totp only includes verified factors, so that leftover
      // is invisible to loadFactors()'s "already set up" check. .all includes
      // it, so clear it out before trying to enroll fresh.
      const { data: existing } = await supabase.auth.mfa.listFactors()
      const stale = existing?.all.find((f) => f.factor_type === "totp" && f.status === "unverified")
      if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id })

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "826 Auto Care",
      })
      if (error || !data) {
        toast.error(error?.message ?? "Failed to start authenticator setup.")
        return
      }
      setEnroll({
        factorId:  data.id,
        // Base64 is far more reliably rendered as a data: URI across browsers
        // than the `;utf-8,<url-encoded>` form Supabase's own type comment
        // suggests — no special characters in the SVG markup need escaping.
        // btoa() is Latin1-only, so the UTF-8 string has to be re-encoded
        // through escape/encodeURIComponent first (the standard browser
        // trick for UTF-8-safe base64).
        qrCodeUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(data.totp.qr_code)))}`,
        secret:    data.totp.secret,
      })
      setCode("")
      setVerifyError("")
    } finally {
      setEnrolling(false)
    }
  }

  async function cancelEnroll() {
    // Clean up the just-created factor so it doesn't block the next attempt
    // with the friendly_name collision described in startEnroll() above.
    if (enroll) {
      const supabase = createClient()
      await supabase.auth.mfa.unenroll({ factorId: enroll.factorId }).catch(() => {})
    }
    setEnroll(null)
    setCode("")
    setVerifyError("")
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!enroll) return
    if (!code.trim()) {
      setVerifyError("Enter the 6-digit code from your app.")
      return
    }
    setVerifying(true)
    setVerifyError("")
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enroll.factorId,
        code:     code.trim(),
      })
      if (error) {
        setVerifyError(error.message)
        return
      }
      toast.success("Authenticator app enabled.")
      setEnroll(null)
      setCode("")
      await loadFactors()
    } finally {
      setVerifying(false)
    }
  }

  async function confirmRemove() {
    if (!verifiedFactorId) return
    setRemoving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success("Authenticator app removed.")
      setRemoveConfirmOpen(false)
      await loadFactors()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden mt-6">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-heading">Two-Factor Authentication</p>
          <p className="text-xs text-muted">
            An email code works for every login. Add an authenticator app for a faster alternative.
          </p>
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : enroll ? (
          <form onSubmit={confirmEnroll} className="space-y-4">
            <p className="text-sm text-body">
              Scan this code with your authenticator app (Google Authenticator, Authy, etc.), then enter the
              6-digit code it shows to confirm.
            </p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enroll.qrCodeUrl}
                alt="Authenticator QR code"
                className="w-40 h-40 border border-border rounded-sm"
              />
            </div>
            <p className="text-xs text-muted text-center">
              Can&apos;t scan? Enter this code manually:{" "}
              <span className="font-mono text-body">{enroll.secret}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                if (verifyError) setVerifyError("")
              }}
              placeholder="123456"
              className={`w-full px-3 py-2.5 text-center text-lg tracking-[0.3em] border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                verifyError ? "border-status-delayed bg-status-delayed/10" : "border-border"
              }`}
            />
            {verifyError && <p className="text-xs text-status-delayed">{verifyError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={verifying}>
                {verifying ? "Verifying…" : "Confirm & Enable"}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelEnroll} disabled={verifying}>
                Cancel
              </Button>
            </div>
          </form>
        ) : verifiedFactorId ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-body">Authenticator app is enabled for your account.</p>
            <Button variant="danger" size="sm" onClick={() => setRemoveConfirmOpen(true)}>
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-body">Not set up yet.</p>
            <Button onClick={startEnroll} disabled={enrolling}>
              <QrCode className="w-3.5 h-3.5" /> {enrolling ? "Starting…" : "Set Up Authenticator App"}
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={removeConfirmOpen}
        onClose={() => !removing && setRemoveConfirmOpen(false)}
        onConfirm={confirmRemove}
        title="Remove Authenticator App?"
        message="You'll go back to receiving a verification code by email on every login."
        confirmLabel={removing ? "Removing…" : "Remove"}
        tone="danger"
        loading={removing}
        icon={Trash2}
      />
    </div>
  )
}
