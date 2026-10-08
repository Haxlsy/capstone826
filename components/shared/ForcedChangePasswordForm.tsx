"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Check, ShieldAlert } from "lucide-react"

const ROLE_ROUTES: Record<string, string> = {
  super_admin: "/dashboard/admin",
  admin: "/dashboard/admin",
  operations: "/dashboard/operations",
  sales: "/dashboard/sales",
  head_detailer: "/head-technician",
  head_installer: "/head-technician",
}

/**
 * Mandatory password-change screen shown on first login (or after an admin
 * password reset) — trimmed variant of `ChangePasswordSettings` that gates
 * the rest of the app instead of living in Settings. On success it clears
 * `must_change_password` server-side (via /api/auth/change-password) and
 * sends the user straight into their role home.
 */
export default function ForcedChangePasswordForm({ role }: { role: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [show, setShow] = useState({ current: false, new: false, confirm: false })
  const [errors, setErrors] = useState<Partial<typeof form>>({})
  const [serverError, setServerError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // MFA step — set once the current password has been verified (see
  // handleSubmit); the password isn't actually changed until the code below
  // is verified too (app/api/auth/change-password/route.ts, phase 2).
  const [mfaChallenge, setMfaChallenge] = useState<{ challengeId: string; method: "email" | "totp" } | null>(null)
  const [mfaCode, setMfaCode] = useState("")
  const [mfaError, setMfaError] = useState("")
  const [mfaSubmitting, setMfaSubmitting] = useState(false)

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate() {
    const e: Partial<typeof form> = {}
    if (!form.currentPassword) e.currentPassword = "Current password is required."
    if (!form.newPassword) e.newPassword = "New password is required."
    else if (form.newPassword.length < 8) e.newPassword = "Password must be at least 8 characters."
    if (!form.confirmPassword) e.confirmPassword = "Please confirm your new password."
    else if (form.newPassword !== form.confirmPassword) e.confirmPassword = "Passwords do not match."
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError("")
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setServerError(json.error ?? "Something went wrong.")
        return
      }
      if (json.mfaRequired) {
        setMfaChallenge({ challengeId: json.challengeId, method: json.method })
        setMfaCode("")
        setMfaError("")
        return
      }
      router.push(ROLE_ROUTES[role] ?? "/")
    } catch {
      setServerError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyMfa(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaChallenge) return
    if (!mfaCode.trim()) {
      setMfaError("Enter the 6-digit code.")
      return
    }
    setMfaError("")
    setMfaSubmitting(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: mfaChallenge.challengeId,
          code:        mfaCode.trim(),
          newPassword: form.newPassword,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMfaError(json.error ?? "Incorrect code. Please try again.")
        return
      }
      router.push(ROLE_ROUTES[role] ?? "/")
    } catch {
      setMfaError("Network error. Please try again.")
    } finally {
      setMfaSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-card overflow-hidden">
        <div className="flex items-start gap-3 px-6 py-5 border-b border-border-subtle bg-status-warning/10">
          <ShieldAlert className="w-5 h-5 shrink-0 text-status-warning mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-heading">Change your password to continue</p>
            <p className="text-xs text-muted mt-0.5">
              For security, you must set a new password before accessing your account.
            </p>
          </div>
        </div>

        {mfaChallenge ? (
          <form onSubmit={handleVerifyMfa} className="px-6 py-5 space-y-5">
            <p className="text-sm text-body">
              {mfaChallenge.method === "totp"
                ? "Enter the code from your authenticator app to confirm this change."
                : "Enter the 6-digit code we emailed you to confirm this change. It expires in 10 minutes."}
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={mfaCode}
              onChange={(e) => {
                setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                if (mfaError) setMfaError("")
              }}
              placeholder="123456"
              className={`w-full px-3 py-2.5 text-center text-lg tracking-[0.3em] border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                mfaError ? "border-status-delayed bg-status-delayed/10" : "border-border"
              }`}
            />
            {mfaError && <p className="text-xs text-status-delayed">{mfaError}</p>}
            <button
              type="submit"
              disabled={mfaSubmitting}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-sm hover:bg-shell-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mfaSubmitting ? "Verifying…" : "Verify"}
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {serverError && (
            <div className="bg-status-delayed/10 border border-status-delayed/30 text-status-delayed text-sm rounded-sm px-4 py-3">
              {serverError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-body">
              Current Password <span className="text-status-delayed">*</span>
            </label>
            <div className="relative">
              <input
                type={show.current ? "text" : "password"}
                value={form.currentPassword}
                onChange={(e) => setField("currentPassword", e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  errors.currentPassword ? "border-status-delayed bg-status-delayed/10" : "border-border"
                }`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body"
              >
                {show.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && <p className="text-xs text-status-delayed">{errors.currentPassword}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-body">
              New Password <span className="text-status-delayed">*</span>
            </label>
            <div className="relative">
              <input
                type={show.new ? "text" : "password"}
                value={form.newPassword}
                onChange={(e) => setField("newPassword", e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  errors.newPassword ? "border-status-delayed bg-status-delayed/10" : "border-border"
                }`}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body"
              >
                {show.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && <p className="text-xs text-status-delayed">{errors.newPassword}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-body">
              Confirm New Password <span className="text-status-delayed">*</span>
            </label>
            <div className="relative">
              <input
                type={show.confirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => setField("confirmPassword", e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  errors.confirmPassword ? "border-status-delayed bg-status-delayed/10" : "border-border"
                }`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body"
              >
                {show.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-status-delayed">{errors.confirmPassword}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-sm hover:bg-shell-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              "Saving..."
            ) : (
              <>
                <Check className="w-4 h-4" />
                Update Password &amp; Continue
              </>
            )}
          </button>
        </form>
        )}
      </div>
    </div>
  )
}
