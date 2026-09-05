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
  toastRef.current = toast

  // Rehydrate lockout from localStorage on mount
  useEffect(() => {
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

  const locked = lockUntil !== null && Date.now() < lockUntil

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

      if (data.user?.must_change_password) {
        router.push("/change-password-required")
      } else {
        router.push(ROLE_ROUTES[data.user?.role ?? ""] ?? "/")
      }
    } catch {
      toastRef.current.error("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const form = (
    <form onSubmit={handleSubmit} noValidate className="w-full space-y-5">
      <div>
        <label htmlFor="login-username" className="mb-1.5 block text-sm font-medium text-heading">
          Username
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              if (errors.username) setErrors((p) => ({ ...p, username: undefined }))
            }}
            placeholder="Username"
            disabled={locked}
            suppressHydrationWarning
            className={cn(
              "h-12 w-full rounded-pill border bg-surface pl-11 pr-4 text-sm text-heading shadow-card",
              "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
              errors.username ? "border-status-delayed" : "border-border",
            )}
          />
        </div>
        {errors.username && <p className="mt-1 text-xs text-status-delayed">{errors.username}</p>}
      </div>

      <div>
        <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-heading">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) setErrors((p) => ({ ...p, password: undefined }))
            }}
            placeholder="Password"
            disabled={locked}
            suppressHydrationWarning
            className={cn(
              "h-12 w-full rounded-pill border bg-surface pl-11 pr-11 text-sm text-heading shadow-card",
              "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
              errors.password ? "border-status-delayed" : "border-border",
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-body"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password ? (
          <p className="mt-1 text-xs text-status-delayed">{errors.password}</p>
        ) : (
          <div className="mt-1.5 flex justify-end">
            <span className="text-xs font-medium text-primary/60">Forgot password?</span>
          </div>
        )}
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-sm bg-status-delayed/10 px-3 py-2 text-xs text-status-delayed">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            Too many failed attempts. Try again in <strong>{remaining}s</strong>.
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || locked}
        className={cn(
          "h-12 w-full rounded-pill bg-gradient-to-b from-accent to-primary text-sm font-semibold text-white shadow-glow transition-opacity",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isLoading ? "Signing in…" : locked ? `Locked · ${remaining}s` : "Login"}
      </button>
    </form>
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-surface-subtle md:overflow-hidden md:bg-surface">
      {/* Desktop background art — the 826 car illustration, bleeding off the left edge */}
      <picture>
        <source srcSet="/assets/login-car.webp" type="image/webp" />
        <img
          src="/assets/login-car.png"
          alt=""
          aria-hidden
          fetchPriority="high"
          decoding="async"
          className="animate-fade-in pointer-events-none absolute bottom-0 left-[-6%] hidden h-full w-auto max-w-none object-contain object-left-bottom md:block"
          style={{ animationDuration: "0.9s" }}
        />
      </picture>

      {/* Mobile header band */}
      <div className="animate-fade-in relative flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-primary to-shell px-6 pb-16 pt-16 text-center md:hidden">
        <img src="/assets/main-logo.png" alt="826" className="h-24 w-auto object-contain" />
        <p className="text-sm font-semibold text-white/90">Auto Aesthetic &amp; Protection</p>
      </div>

      {/* Desktop brand */}
      <header className="animate-fade-in relative z-10 hidden items-center gap-3 px-10 py-8 md:flex">
        <img src="/assets/main-logo.png" alt="826" className="h-12 w-auto object-contain" />
        <span className="text-lg font-semibold text-display text-heading">
          Auto Aesthetic &amp; Protection
        </span>
      </header>

      {/* Form area */}
      <div className="relative z-10 -mt-8 flex flex-1 items-start justify-center rounded-t-[2rem] bg-surface px-6 pb-12 pt-9 md:mt-0 md:items-center md:justify-end md:rounded-none md:bg-transparent md:px-[8%] md:pb-0">
        <div className="animate-fade-in-up w-full max-w-[420px]">
          <div className="mb-6">
            <h1 className="text-3xl font-bold uppercase text-display text-heading md:text-4xl">
              Welcome Back!
            </h1>
            <p className="mt-1 text-sm text-body">Please enter your credentials.</p>
            <div className="mt-4 h-px w-full bg-primary/40" />
          </div>
          {form}
        </div>
      </div>

      <div className="animate-fade-in relative z-10 pb-4 text-center text-[11px] text-muted">
        826 Auto Aesthetic &amp; Protection · Ortigas Extension
      </div>
    </div>
  )
}
