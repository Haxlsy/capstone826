"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react"
import { Drawer } from "@/components/ui/Drawer"
import { Button } from "@/components/ui/Button"
import { ConfirmModal } from "@/components/ui/Modal"
import { validateName } from "@/lib/name"
import { logView } from "@/lib/client/log-view"

// Strips all whitespace (not just leading/trailing) so a multi-word name
// part like "Dela Cruz" can't leak a space into the generated username/
// password — neither field allows spaces.
function slug(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase()
}

function generateUsername(firstName: string, lastName: string): string {
  const first = slug(firstName)
  const last = slug(lastName)
  if (!first || !last) return ""
  return `${first}.${last}`
}

function generatePassword(firstName: string, lastName: string): string {
  const first = slug(firstName)
  const last = slug(lastName)
  if (!first || !last) return ""
  return `${first}_826_${last}`
}

type UserRole = "admin" | "operations" | "sales" | "head_detailer" | "head_installer"

interface AccountData {
  id: string
  full_name: string
  first_name: string | null
  last_name: string | null
  username: string
  role: UserRole
}

interface AddAccountModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editAccount?: AccountData
  /** "staff" shows operations/sales/head roles. "admin" shows only Admin role. */
  mode?: "staff" | "admin"
}

const STAFF_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "operations",     label: "Operations" },
  { value: "sales",          label: "Sales" },
  { value: "head_detailer",  label: "Head Detailer" },
  { value: "head_installer", label: "Head Installer" },
]

const ADMIN_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
]

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  username: "",
  password: "",
  role: "operations" as UserRole,
}

export default function AddAccountModal({
  open,
  onClose,
  onSuccess,
  editAccount,
  mode = "staff",
}: AddAccountModalProps) {
  const isEdit = !!editAccount
  const roleOptions = mode === "admin" ? ADMIN_ROLE_OPTIONS : STAFF_ROLE_OPTIONS

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    role: (mode === "admin" ? "admin" : "operations") as UserRole,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof EMPTY_FORM>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState("")
  // A confirm step before the actual create/update request — the form only
  // got as far as validating and saving immediately before.
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Reset / pre-fill when modal opens
  useEffect(() => {
    if (open) {
      setErrors({})
      setServerError("")
      setShowPassword(false)
      setConfirmOpen(false)

      if (editAccount) {
        setForm({
          firstName: editAccount.first_name ?? "",
          lastName:  editAccount.last_name ?? "",
          username:  editAccount.username,
          password:  "",
          role:      editAccount.role,
        })
        logView("account", editAccount.full_name)
      } else {
        setForm({
          ...EMPTY_FORM,
          role: (mode === "admin" ? "admin" : "operations") as UserRole,
        })
      }
    }
  }, [open, editAccount, mode])

  // Auto-generate username and password from name (new accounts only)
  useEffect(() => {
    if (!isEdit) {
      setForm((prev) => ({
        ...prev,
        username: generateUsername(form.firstName, form.lastName),
        password: generatePassword(form.firstName, form.lastName),
      }))
    }
  }, [form.firstName, form.lastName, isEdit])

  function validate() {
    const e: Partial<typeof EMPTY_FORM> = {}
    const firstError = validateName(form.firstName, "First name")
    if (firstError) e.firstName = firstError
    const lastError = validateName(form.lastName, "Last name")
    if (lastError) e.lastName = lastError
    if (!isEdit) {
      if (!form.username.trim()) e.username = "Username is required."
      else if (!/^[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$/.test(form.username.trim()))
        e.username = "Username must contain a dot (e.g. first.last)."
      if (!form.password) e.password = "Password is required."
      else if (form.password.length < 8) e.password = "Password must be at least 8 characters."
    }
    return e
  }

  // Validates, then asks for confirmation instead of saving straight away.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError("")

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setConfirmOpen(true)
  }

  async function performSubmit() {
    setSubmitting(true)

    try {
      let res: Response

      if (isEdit) {
        res = await fetch("/api/admin/update-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId:    editAccount!.id,
            firstName: form.firstName.trim(),
            lastName:  form.lastName.trim(),
          }),
        })
      } else {
        res = await fetch("/api/admin/create-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName:  form.lastName.trim(),
            username:  form.username.trim(),
            password:  form.password,
            role:      form.role,
          }),
        })
      }

      const json = await res.json()

      if (!res.ok) {
        // Back to the form (not the confirm dialog) so the error is visible
        // next to the fields it's about.
        setConfirmOpen(false)
        setServerError(json.error ?? "Something went wrong.")
        return
      }

      setConfirmOpen(false)
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

  const roleLabel = roleOptions.find((o) => o.value === form.role)?.label ?? form.role
  const fullNameDisplay = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()

  return (
    <>
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      title={isEdit ? "Edit Account" : mode === "admin" ? "Add Admin Account" : "Add New Account"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Save Account"}
          </Button>
        </>
      }
    >
        <form onSubmit={handleSubmit} className="space-y-5">
          {serverError && (
            <div className="bg-status-delayed/10 border border-status-delayed/30 text-status-delayed text-sm rounded-sm px-4 py-3">
              {serverError}
            </div>
          )}

          <p className="text-xs text-muted"><span className="text-status-delayed">*</span> Required fields</p>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-body">
                First Name <span className="text-status-delayed">*</span>
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                className={`w-full px-3 py-2.5 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  errors.firstName ? "border-status-delayed bg-status-delayed/10" : "border-border"
                }`}
                placeholder="e.g. Juan"
              />
              {errors.firstName && <p className="text-xs text-status-delayed">{errors.firstName}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-body">
                Last Name <span className="text-status-delayed">*</span>
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                className={`w-full px-3 py-2.5 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  errors.lastName ? "border-status-delayed bg-status-delayed/10" : "border-border"
                }`}
                placeholder="e.g. Dela Cruz"
              />
              {errors.lastName && <p className="text-xs text-status-delayed">{errors.lastName}</p>}
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-body">
              Username {!isEdit && <span className="text-status-delayed">*</span>}
              {isEdit && <span className="text-muted font-normal"> (cannot be changed)</span>}
            </label>
            <input
              type="text"
              value={form.username}
              readOnly={isEdit}
              onChange={(e) => !isEdit && setField("username", e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-sm focus:outline-none transition-colors font-mono ${
                isEdit
                  ? "border-border bg-surface-subtle text-muted cursor-not-allowed"
                  : errors.username
                  ? "border-status-delayed bg-status-delayed/10 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  : "border-border focus:ring-2 focus:ring-primary/20 focus:border-primary"
              }`}
              placeholder="Auto-filled from name"
            />
            {!isEdit && (
              <p className="text-xs text-primary">Auto-generated from name (editable)</p>
            )}
            {errors.username && <p className="text-xs text-status-delayed">{errors.username}</p>}
          </div>

          {/* Password — new accounts only */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-body">
                Password <span className="text-status-delayed">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  readOnly
                  aria-label="Auto-generated password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-border rounded-sm bg-surface-subtle text-body cursor-not-allowed font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-primary">
                Auto-generated from name: <span className="font-mono">{form.password || "—"}</span>
              </p>
              {errors.password && <p className="text-xs text-status-delayed">{errors.password}</p>}
            </div>
          )}

          {/* Role */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-body">
              Role <span className="text-status-delayed">*</span>
              {isEdit && <span className="text-muted font-normal"> (cannot be changed)</span>}
            </label>
            {mode === "admin" || isEdit ? (
              <div className="w-full px-3 py-2.5 text-sm border border-border rounded-sm bg-surface-subtle text-body cursor-not-allowed">
                {roleOptions.find((o) => o.value === form.role)?.label ?? form.role}
              </div>
            ) : (
              <select
                value={form.role}
                onChange={(e) => setField("role", e.target.value)}
                aria-label="Role"
                className="w-full px-3 py-2.5 text-sm border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface transition-colors"
              >
                {roleOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Edit mode hint */}
          {isEdit && (
            <div className="flex items-start gap-2.5 rounded-sm border border-status-warning/30 bg-status-warning/10 px-4 py-3">
              <p className="text-xs text-status-warning">
                To reset this account&apos;s password, use the <span className="font-semibold">Reset Password</span> option from the account menu.
              </p>
            </div>
          )}
        </form>
    </Drawer>

    <ConfirmModal
      open={confirmOpen}
      onClose={() => !submitting && setConfirmOpen(false)}
      onConfirm={performSubmit}
      title={isEdit ? "Save changes?" : "Create account?"}
      message={
        isEdit
          ? `Save changes to ${fullNameDisplay || "this account"}'s account?`
          : `Create a new ${roleLabel} account for ${fullNameDisplay || "this person"}?`
      }
      confirmLabel={submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Account"}
      loading={submitting}
      icon={ShieldCheck}
    />
    </>
  )
}
