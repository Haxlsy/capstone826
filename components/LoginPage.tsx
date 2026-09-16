"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Lock, Eye, EyeOff, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/Toast"

const ROLE_ROUTES: Record<string, string> = {
  super_admin: "/dashboard/admin",
  admin: "/dashboard/admin",
  operations: "/dashboard/operations",
  sales: "/dashboard/sales",
  head_detailer: "/head-technician",
  head_installer: "/head-technician",
}

export default function LoginPage() {
  const router = useRouter()
  const toast = useToast()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockUntil, setLockUntil] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  })

  // Redirected here after being signed out for a newer login elsewhere
  // (proxy.ts — single active session per account). Reads the query param
  // directly via window.location rather than useSearchParams() so this
  // doesn't need a Suspense boundary.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason")
    if (reason === "signed_in_elsewhere") {
      toastRef.current.error("You were signed out because your account signed in on another device.")
      const url = new URL(window.location.href)
      url.searchParams.delete("reason")
      router.replace(url.pathname + url.search)
    }
  }, [router])

  // Rehydrate lockout from localStorage on mount
  useEffect(() => {
    function rehydrate() {
      try {
        const raw = localStorage.getItem("826_login_attempts")
        if (!raw) return
        const saved = JSON.parse(raw) as { attempts: number; lockUntil: number | null }
        if (saved.lockUntil && Date.now() < saved.lockUntil) {
          setAttempts(saved.attempts)
          setLockUntil(saved.lockUntil)
        } else {
          localStorage.removeItem("826_login_attempts")
        }
      } catch {
        /* ignore */
      }
    }
    rehydrate()
  }, [])

  // Countdown ticker while locked
  useEffect(() => {
    if (!lockUntil) return
    const tick = () => {
      const secs = Math.ceil((lockUntil - Date.now()) / 1000)
      if (secs <= 0) {
        setLockUntil(null)
        setAttempts(0)
        setRemaining(0)
        localStorage.removeItem("826_login_attempts")
      } else {
        setRemaining(secs)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockUntil])

  // lockUntil is cleared back to null by the ticking effect above the instant
  // it expires (tick() runs synchronously on mount/whenever lockUntil
  // changes, before the 1s interval even starts) — so this doesn't need its
  // own Date.now() comparison, which isn't safe to call during render.
  const locked = lockUntil !== null

  function validate() {
    const e: { username?: string; password?: string } = {}
    if (!username.trim()) e.username = "Username is required."
    else if (username.trim().length < 3) e.username = "Username must be at least 3 characters."
    if (!password) e.password = "Password is required."
    else if (password.length < 6) e.password = "Password must be at least 6 characters."
    return e
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()

      if (!res.ok) {
        const next = attempts + 1
        setAttempts(next)
        if (next >= 3) {
          const until = Date.now() + 60_000
          setLockUntil(until)
          localStorage.setItem("826_login_attempts", JSON.stringify({ attempts: next, lockUntil: until }))
          toastRef.current.error("Too many failed attempts. Please wait 1 minute.")
        } else {
          localStorage.setItem("826_login_attempts", JSON.stringify({ attempts: next, lockUntil: null }))
          const left = 3 - next
          toastRef.current.error(`Invalid credentials. ${left} attempt${left === 1 ? "" : "s"} remaining.`)
        }
        setIsLoading(false)
        return
      }

      localStorage.removeItem("826_login_attempts")
      setAttempts(0)
      setLockUntil(null)
      try {
        localStorage.setItem("826_user", JSON.stringify(data.user))
      } catch {
        /* ignore */
      }

      // Intentionally leave isLoading=true here — router.push() only starts
      // the navigation (the destination's auth/layout/data chain still has to
      // resolve after this call returns), so resetting it now made the
      // button flicker "Signing in…" -> "Login" -> (actual page) instead of
      // reading as one continuous wait. This page is being replaced either
      // way, so there's nothing to re-enable the button for.
      if (data.user?.must_change_password) {
        router.push("/change-password-required")
      } else {
        router.push(ROLE_ROUTES[data.user?.role ?? ""] ?? "/")
      }
    } catch {
      toastRef.current.error("Network error. Please try again.")
      setIsLoading(false)
    }
  }

  const form = (
    <form onSubmit={handleSubmit} noValidate className="w-full space-y-5">
      {/* Username Field */}
      <div>
        <label htmlFor="login-username" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-heading">
          Username
        </label>
        <div className="group relative">
          <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent" />
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              if (errors.username) setErrors((p) => ({ ...p, username: undefined }))
            }}
            placeholder="Enter your username"
            disabled={locked}
            suppressHydrationWarning
            className={cn(
              "h-12 w-full rounded-full border bg-surface pl-11 pr-4 text-sm text-heading transition-all duration-200",
              "placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent hover:border-slate-300",
              errors.username ? "border-status-delayed text-status-delayed" : "border-slate-200",
            )}
          />
        </div>
        {errors.username && <p className="mt-1.5 text-xs font-medium text-status-delayed">{errors.username}</p>}
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-heading">
          Password
        </label>
        <div className="group relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent" />
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) setErrors((p) => ({ ...p, password: undefined }))
            }}
            placeholder="Enter your password"
            disabled={locked}
            suppressHydrationWarning
            className={cn(
              "h-12 w-full rounded-full border bg-surface pl-11 pr-11 text-sm text-heading transition-all duration-200",
              "placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent hover:border-slate-300",
              errors.password ? "border-status-delayed text-status-delayed" : "border-slate-200",
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-heading focus:outline-none"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Error Row */}
        {errors.password && (
          <p className="mt-1.5 text-xs font-medium text-status-delayed">{errors.password}</p>
        )}
      </div>

      {/* Lockout Alert */}
      {locked && (
        <div className="flex items-center gap-2.5 rounded-xl bg-status-delayed/10 border border-status-delayed/20 px-3.5 py-2.5 text-xs font-medium text-status-delayed">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            Too many failed attempts. Try again in <strong>{remaining}s</strong>.
          </span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || locked}
        className={cn(
          "h-12 w-full rounded-full bg-linear-to-b from-accent to-primary text-sm font-semibold text-white shadow-md cursor-pointer transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0 active:shadow-xs",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
        )}
      >
        {isLoading ? "Signing in…" : locked ? `Locked · ${remaining}s` : "Login"}
      </button>
    </form>
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-surface-subtle md:overflow-hidden md:bg-surface">
    {/* Desktop background art — 826 car illustration */}
      <picture className="pointer-events-none absolute inset-0 hidden md:block">
        <source srcSet="/assets/826_car_asset.png" type="image/png" />
        <img
          src="/assets/826_car_asset.png"
          alt=""
          aria-hidden="true"
          fetchPriority="high" 
          decoding="async"
          className="animate-fade-in pointer-events-none absolute bottom-0 left-[-15%] h-full w-auto max-w-none object-contain object-bottom-left select-none xl:left-[-10%] 2xl:left-0 transition-all duration-700 ease-out -translate-x-20"
          style={{ animationDuration: "0.9s" }}
        />
      </picture>

      {/* Mobile header band */}
      <div className="animate-fade-in relative flex flex-col items-center justify-center gap-2.5 bg-gradient-to-b from-primary via-teal-900 to-teal-950 px-6 pt-12 pb-14 text-center md:hidden">
        <img 
          src="/assets/main-logo.png" 
          alt="826" 
          className="h-14 w-auto object-contain drop-shadow-md" 
        />
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-100/80">
          Auto Aesthetic &amp; Protection
        </p>
      </div>

      {/* Desktop brand */}
      <header className="animate-fade-in relative z-10 hidden items-center gap-3 rounded-full bg-white px-6 py-2.5 shadow-sm border border-slate-100 md:flex w-fit ml-10 mt-6">
        <img src="/assets/main-logo.png" alt="826" className="h-5 w-auto object-contain" />
        <span className="text-sm font-semibold text-heading">
          Auto Aesthetic &amp; Protection
        </span>
      </header>

      {/* Form area */}
      <div className="relative z-10 flex flex-1 items-start justify-center rounded-t-4xl bg-surface px-6 md:mt-0 md:items-center md:justify-end md:rounded-none md:bg-transparent md:px-[8%] md:pb-0">
        <div className="animate-fade-in-up w-full max-w-[420px] rounded-2xl bg-white p-8 border border-slate-200/80 shadow-lg shadow-slate-200/50">
          
          <div className="mb-6 border-b border-slate-100 pb-5">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">
              Welcome Back!
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-400 uppercase tracking-wider">
              Enter your credentials
            </p>
          </div>

          {/* Form */}
          {form}

        </div>
      </div>

      <div className="animate-fade-in relative z-10 pb-4 text-center">
        <span className="inline-block rounded-full bg-white/80 px-4 py-1 text-[11px] font-medium text-slate-700 backdrop-blur-sm border border-white/50 shadow-xs">
          826 Auto Aesthetic &amp; Protection · Ortigas Extension
        </span>
      </div>
    </div>
  )
}
