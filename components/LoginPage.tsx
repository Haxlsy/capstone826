"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Wrench, User, Lock, Eye, EyeOff, ShieldCheck, LogIn } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function validate() {
    const newErrors: { username?: string; password?: string } = {}
    if (!username.trim()) {
      newErrors.username = "Username is required."
    } else if (username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters."
    }
    if (!password) {
      newErrors.password = "Password is required."
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters."
    }
    return newErrors
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setServerError(null)
    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setServerError(data.error ?? "Something went wrong.")
        return
      }

      // Persist user info for topbar/profile display across the app
      try {
        localStorage.setItem("826_user", JSON.stringify(data.user))
      } catch {}

      const roleRoutes: Record<string, string> = {
        super_admin: "/dashboard/admin",
        admin: "/dashboard/admin",
        operations: "/dashboard/operations",
        sales: "/dashboard/sales",
        head_technician: "/head-technician",
      }

      const role: string = data.user?.role ?? ""
      console.log("[Login] role:", role, "→ redirecting to", roleRoutes[role] ?? "/")
      router.push(roleRoutes[role] ?? "/")
    } catch {
      setServerError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-slate-100 to-blue-50 px-4">

      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md mb-3">
          <Wrench className="text-white w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">826 Auto Care</h1>
        <p className="text-xs tracking-[0.2em] text-slate-400 uppercase mt-1">
          Excellence in Automotive Care
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl px-10 py-10">

          <>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Welcome Back</h2>
            <p className="text-sm text-slate-500 mb-8">
              Please enter your credentials to access the Operations Centre.
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Email / Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }))
                    }}
                    placeholder="Ex. role-name"
                    className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                      errors.username ? "border-red-400 focus:ring-red-400" : "border-slate-200"
                    }`}
                  />
                </div>
                {errors.username && (
                  <p className="mt-1.5 text-xs text-red-500">{errors.username}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium transition"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                    }}
                    placeholder="••••••••••"
                    className={`w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                      errors.password ? "border-red-400 focus:ring-red-400" : "border-slate-200"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>
                )}
              </div>

              {serverError && (
                <p className="text-xs text-red-500 text-center">{serverError}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-linear-to-r from-blue-500 to-blue-700 text-white font-semibold text-sm tracking-wide shadow-md hover:from-blue-600 hover:to-blue-800 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Signing in…" : "Login"}
                {!isLoading && <LogIn className="w-4 h-4" />}
              </button>
            </form>

            {/* Authorized personnel notice */}
            <div className="mt-8 flex gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">
                  Authorized Personnel Only
                </p>
                <p className="text-xs text-green-600 leading-relaxed">
                  This portal is restricted to 826 Auto Care Admin, Head Technicians, and
                  Technicians. All activities are logged for security.
                </p>
              </div>
            </div>
          </>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-slate-400">
        © 2024 Precision Atelier Operations Centre. All Rights Reserved.
      </p>

      {/* Workshop badge */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-semibold text-slate-600 tracking-wide">
          WORKSHOP ALPHA · 826 HQ
        </span>
      </div>
    </div>
  )
}
