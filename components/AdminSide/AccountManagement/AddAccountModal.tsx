"use client"

import { useEffect, useState } from "react"
import { X, Eye, EyeOff } from "lucide-react"

type UserRole = "operations" | "sales" | "head_technician" | "technician"

interface AddAccountModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "operations", label: "Operations" },
  { value: "sales", label: "Sales" },
  { value: "head_technician", label: "Head Technician" },
  { value: "technician", label: "Technician" },
]

const EMPTY_FORM = {
  fullName: "",
  username: "",
  password: "",
  confirmPassword: "",
  role: "operations" as UserRole,
  contactNo: "",
}

export default function AddAccountModal({ open, onClose, onSuccess }: AddAccountModalProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof EMPTY_FORM>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState("")

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setErrors({})
      setServerError("")
      setShowPassword(false)
      setShowConfirm(false)
    }
  }, [open])

  // Prevent background scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  function validate() {
    const e: Partial<typeof EMPTY_FORM> = {}
    if (!form.fullName.trim()) e.fullName = "Full name is required."
    if (!form.username.trim()) e.username = "Username is required."
    if (!form.password) e.password = "Password is required."
    else if (form.password.length < 8) e.password = "Password must be at least 8 characters."
    if (!form.confirmPassword) e.confirmPassword = "Please confirm your password."
    else if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match."
    if (!form.contactNo.trim()) {
      e.contactNo = "Contact number is required."
    } else if (!/^[0-9+\-\s()]{7,15}$/.test(form.contactNo.trim())) {
      e.contactNo = "Enter a valid contact number (digits only, 7–15 characters)."
    }
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
      const res = await fetch("/api/admin/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          contactNo: form.contactNo.trim(),
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setServerError(json.error ?? "Something went wrong.")
        return
      }

      onSuccess()
      onClose()
    } catch {
      setServerError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer — slides in from right */}
      <div
        className={`fixed top-0 right-0 h-full w-120 bg-white z-50 shadow-2xl flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">Add New Account</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {serverError}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                errors.fullName ? "border-red-400 bg-red-50" : "border-gray-200"
              }`}
              placeholder=""
            />
            {errors.fullName && (
              <p className="text-xs text-red-500">{errors.fullName}</p>
            )}
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                errors.username ? "border-red-400 bg-red-50" : "border-gray-200"
              }`}
              placeholder=""
            />
            {errors.username && (
              <p className="text-xs text-red-500">{errors.username}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                  errors.password ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
                placeholder=""
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => setField("confirmPassword", e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                  errors.confirmPassword ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
                placeholder=""
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              value={form.role}
              onChange={(e) => setField("role", e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white transition-colors"
            >
              {ROLE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Contact Number */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Contact Number</label>
            <input
              type="text"
              value={form.contactNo}
              onChange={(e) => setField("contactNo", e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                errors.contactNo ? "border-red-400 bg-red-50" : "border-gray-200"
              }`}
              placeholder=""
            />
            {errors.contactNo && (
              <p className="text-xs text-red-500">{errors.contactNo}</p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Save Account"}
          </button>
        </div>
      </div>
    </>
  )
}
