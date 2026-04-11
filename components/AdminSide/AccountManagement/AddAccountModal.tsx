"use client"

import { useEffect, useState } from "react"
import { X, Eye, EyeOff, Lock } from "lucide-react"

function generatePassword(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  const first = parts[0].toLowerCase()
  const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : parts[0].toLowerCase()
  return `${first}_826_${last}`
}

type UserRole = "admin" | "operations" | "sales" | "head_detailer" | "head_installer" | "installer" | "detailer"

interface AccountData {
  user_id: string
  full_name: string
  user_name: string
  role: UserRole
  contact_no: string
}

interface AddAccountModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editAccount?: AccountData
}

const ALL_ROLE_OPTIONS: { value: UserRole; label: string; superAdminOnly?: boolean }[] = [
  { value: "admin",          label: "Admin",          superAdminOnly: true },
  { value: "operations",     label: "Operations" },
  { value: "sales",          label: "Sales" },
  { value: "head_detailer",  label: "Head Detailer" },
  { value: "head_installer", label: "Head Installer" },
  { value: "installer",      label: "Installer" },
  { value: "detailer",       label: "Detailer" },
]

const EMPTY_FORM = {
  fullName: "",
  username: "",
  password: "",
  confirmPassword: "",
  role: "operations" as UserRole,
  contactNo: "",
}

export default function AddAccountModal({ open, onClose, onSuccess, editAccount }: AddAccountModalProps) {
  const isEdit = !!editAccount

  const [form, setForm] = useState(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof EMPTY_FORM>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState("")
  const [currentUserRole, setCurrentUserRole] = useState("")

  const roleOptions = ALL_ROLE_OPTIONS.filter(
    (opt) => !opt.superAdminOnly || currentUserRole === "super_admin"
  )

  // Reset / pre-fill when modal opens
  useEffect(() => {
    if (open) {
      setErrors({})
      setServerError("")
      setShowPassword(false)
      setShowConfirm(false)
      try {
        const raw = localStorage.getItem("826_user")
        if (raw) setCurrentUserRole(JSON.parse(raw).role ?? "")
      } catch {}

      if (editAccount) {
        setForm({
          fullName: editAccount.full_name,
          username: editAccount.user_name,
          password: "",
          confirmPassword: "",
          role: editAccount.role,
          contactNo: editAccount.contact_no,
        })
      } else {
        setForm(EMPTY_FORM)
      }
    }
  }, [open, editAccount])

  // Auto-generate password from full name (new accounts only)
  useEffect(() => {
    if (!isEdit && form.fullName) {
      const generated = generatePassword(form.fullName)
      setForm((prev) => ({ ...prev, password: generated, confirmPassword: generated }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fullName, isEdit])

  // Prevent background scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  function validate() {
    const e: Partial<typeof EMPTY_FORM> = {}
    if (!form.fullName.trim()) e.fullName = "Full name is required."
    if (!isEdit && !form.username.trim()) e.username = "Username is required."
    if (!isEdit) {
      if (!form.password) e.password = "Password is required."
      else if (form.password.length < 8) e.password = "Password must be at least 8 characters."
      if (!form.confirmPassword) e.confirmPassword = "Please confirm your password."
      else if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match."
    } else if (form.password) {
      if (form.password.length < 8) e.password = "Password must be at least 8 characters."
      if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match."
    }
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
      let res: Response

      if (isEdit) {
        res = await fetch("/api/admin/update-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: editAccount!.user_id,
            fullName: form.fullName.trim(),
            role: form.role,
            contactNo: form.contactNo.trim(),
            ...(form.password ? { password: form.password } : {}),
          }),
        })
      } else {
        res = await fetch("/api/admin/create-account", {
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
      }

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
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit ? "Edit Account" : "Add New Account"}
          </h2>
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

          {/* Required fields note */}
          <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required fields</p>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setField("fullName", e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                errors.fullName ? "border-red-400 bg-red-50" : "border-gray-200"
              }`}
              placeholder="e.g. Juan Dela Cruz"
            />
            {errors.fullName && (
              <p className="text-xs text-red-500">{errors.fullName}</p>
            )}
          </div>

          {/* Username — read-only in edit mode */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Username {!isEdit && <span className="text-red-500">*</span>}
              {isEdit && <span className="text-gray-400 font-normal"> (cannot be changed)</span>}
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => !isEdit && setField("username", e.target.value)}
              readOnly={isEdit}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none transition-colors ${
                isEdit
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : errors.username
                  ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  : "border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              }`}
              placeholder="e.g. juan.delacruz"
            />
            {errors.username && (
              <p className="text-xs text-red-500">{errors.username}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Password{" "}
              {!isEdit && <span className="text-red-500">*</span>}
              {isEdit && <span className="text-gray-400 font-normal"> (leave blank to keep current)</span>}
            </label>
            {!isEdit ? (
              <>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    readOnly
                    className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-blue-500">
                  Auto-generated from full name: <span className="font-mono">{form.password || "—"}</span>
                </p>
              </>
            ) : (
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
            )}
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password — only shown in edit mode */}
          {isEdit && (
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
          )}

          {/* Role */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={form.role}
              onChange={(e) => setField("role", e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white transition-colors"
            >
              {roleOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Contact Number */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Contact Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.contactNo}
              onChange={(e) => setField("contactNo", e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                errors.contactNo ? "border-red-400 bg-red-50" : "border-gray-200"
              }`}
              placeholder="e.g. 09171234567"
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
            {submitting ? "Saving..." : isEdit ? "Save Changes" : "Save Account"}
          </button>
        </div>
      </div>
    </>
  )
}
