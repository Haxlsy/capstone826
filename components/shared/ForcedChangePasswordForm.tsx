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
      router.push(ROLE_ROUTES[role] ?? "/")
    } catch {
      setServerError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
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
      </div>
    </div>
  )
}
