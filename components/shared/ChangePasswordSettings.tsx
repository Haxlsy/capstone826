"use client"

import { useState } from "react"
import { Eye, EyeOff, KeyRound, Check, ShieldCheck } from "lucide-react"

export default function ChangePasswordSettings() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [show, setShow] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [errors, setErrors] = useState<Partial<typeof form>>({})
  const [serverError, setServerError] = useState("")
  const [success, setSuccess] = useState(false)
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
      setSuccess(true)
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      setTimeout(() => setSuccess(false), 3500)
    } catch {
      setServerError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-lg">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your account security.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Change Password</p>
            <p className="text-xs text-gray-400">Update your login password.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {serverError}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg px-4 py-3">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Password updated successfully.
            </div>
          )}

          {/* Required note */}
          <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required fields</p>

          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={show.current ? "text" : "password"}
                value={form.currentPassword}
                onChange={(e) => setField("currentPassword", e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                  errors.currentPassword ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
                placeholder=""
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {show.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-xs text-red-500">{errors.currentPassword}</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={show.new ? "text" : "password"}
                value={form.newPassword}
                onChange={(e) => setField("newPassword", e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                  errors.newPassword ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {show.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-red-500">{errors.newPassword}</p>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={show.confirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => setField("confirmPassword", e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                  errors.confirmPassword ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
                placeholder=""
              />
              <button
                type="button"
                onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {show.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">{errors.confirmPassword}</p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                "Saving..."
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Update Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
