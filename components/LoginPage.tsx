"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Script from "next/script"
import { User, Lock, Eye, EyeOff, ShieldAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/Toast"
import { checkAlreadySignedIn } from "@/lib/auth/already-signed-in"
import { loginRedirectNoticeCopy, isLoginRedirectNotice, type LoginRedirectNotice } from "@/lib/auth/login-redirect-notice"

// Minimal shape of the global the Turnstile script attaches — just what this
// page calls.
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
  }
}

// Upper bound on how long the form can be held back by the already-signed-in
// check — a slow check may delay the form but must never block it.
const SESSION_CHECK_TIMEOUT_MS = 1_500
const sessionFetch: typeof fetch = (input, init) => fetch(input, init)

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
  // Post-lockout CAPTCHA — the server is authoritative on whether this
  // account needs one (see app/api/auth/login/route.ts); this just reflects
  // what it told us on the last failed attempt.
  const [needsCaptcha, setNeedsCaptcha] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaScriptReady, setCaptchaScriptReady] = useState(false)
  const captchaContainerRef = useRef<HTMLDivElement>(null)
  const captchaWidgetId = useRef<string | null>(null)
  // Persistent counterpart to the toast below — see the effect that sets it.
  const [notice, setNotice] = useState<LoginRedirectNotice | null>(null)

  // MFA step — entered once the password has been verified (see
  // handleSubmit). mfaMethod "totp" shows an authenticator-code prompt with
  // a "use email instead" fallback; "email" shows a code-we-emailed prompt.
  const [step, setStep] = useState<"credentials" | "mfa">("credentials")
  const [mfaMethod, setMfaMethod] = useState<"email" | "totp" | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState("")
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [mfaSubmitting, setMfaSubmitting] = useState(false)
  const [switchingMethod, setSwitchingMethod] = useState(false)
  // Lockout after too many wrong MFA codes (see app/api/auth/verify-mfa/route.ts) —
  // mirrors the credentials step's own lockUntil/remaining pair below, kept
  // separate since this is a different step with its own UI.
  const [mfaLockUntil, setMfaLockUntil] = useState<number | null>(null)
  const [mfaLockRemaining, setMfaLockRemaining] = useState(0)

  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  })

  // "checking" until we know whether this browser already has a live session.
  // Starts as "checking" on server AND client (no hydration mismatch) so the
  // form is never shown — and can't be submitted — before the answer is in.
  const [gate, setGate] = useState<"checking" | "open">("checking")
  const isLoadingRef = useRef(false)
  useEffect(() => {
    isLoadingRef.current = isLoading
  })

  // This page can be open in a tab that was loaded while logged out and is
  // still on screen after another tab of the same browser signed in. Tabs
  // share one cookie jar, so signing in again from that stale form rotates the
  // session token and revokes sessions — the start of a race that can log out
  // both tabs. proxy.ts only bounces a signed-in visitor who navigates here,
  // so check on load, and again whenever the tab is looked at again.
  useEffect(() => {
    let cancelled = false
    const check = async (): Promise<boolean> => {
      const signedIn = await checkAlreadySignedIn(sessionFetch, SESSION_CHECK_TIMEOUT_MS)
      if (cancelled || !signedIn) return false
      // "/" is proxied to the signed-in user's own home (and requireRole
      // handles must_change_password), so no role lookup is needed here.
      window.location.replace("/")
      return true
    }
    void check().then((redirecting) => {
      if (!redirecting && !cancelled) setGate("open")
    })

    const recheck = () => {
      if (!isLoadingRef.current && document.visibilityState === "visible") void check()
    }
    document.addEventListener("visibilitychange", recheck)
    window.addEventListener("focus", recheck)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", recheck)
      window.removeEventListener("focus", recheck)
    }
  }, [])

  // Redirected here after being signed out for a newer login elsewhere
  // (proxy.ts — single active session per account). Reads the query param
  // directly via window.location rather than useSearchParams() so this
  // doesn't need a Suspense boundary.
  //
  // This fires from a BACKGROUND event (a Realtime push, a poll tick, or the
  // next request's 401 on a tab the person isn't necessarily watching) — a
  // toast alone can appear and auto-dismiss before they ever look back at
  // this screen, which alpha testing reported as "no message at all" even
  // though the redirect itself was working. `notice` persists the same
  // explanation on the page (see the banner below) until the person
  // dismisses it or starts typing, so it can't be missed just by bad timing.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason")
    if (isLoginRedirectNotice(reason)) {
      toastRef.current.error(loginRedirectNoticeCopy(reason))
      // Deferred one tick — same shape as the `gate` effect above (a .then()
      // callback) rather than a setState call directly in the effect body.
      queueMicrotask(() => setNotice(reason))
      if (reason === "session_expired") {
        // The server already cleared the auth cookies; drop what only the
        // browser holds (same cleanup as a normal logout, see hooks/useLogout.ts).
        try { localStorage.removeItem("826_user") } catch { /* ignore */ }
        try { navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_APP_CACHES" }) } catch { /* ignore */ }
      }
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

  // Countdown ticker for the MFA lockout — once it expires, drop back to the
  // credentials step instead of leaving a dead code-entry form on screen
  // (handleBackToCredentials is a function declaration, so it's hoisted and
  // safe to call here even though it's defined further down this component).
  useEffect(() => {
    if (!mfaLockUntil) return
    const tick = () => {
      const secs = Math.ceil((mfaLockUntil - Date.now()) / 1000)
      if (secs <= 0) {
        setMfaLockUntil(null)
        setMfaLockRemaining(0)
        handleBackToCredentials()
      } else {
        setMfaLockRemaining(secs)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [mfaLockUntil])
  const mfaLocked = mfaLockUntil !== null

  // Render the Turnstile widget once both the server has told us this
  // account needs one and the script has finished loading. Re-renders are a
  // no-op (widgetId already set) — reset() below (in handleSubmit) clears
  // the token on a failed challenge without tearing the widget down.
  useEffect(() => {
    if (!needsCaptcha || !captchaScriptReady || captchaWidgetId.current) return
    if (!captchaContainerRef.current || !window.turnstile) return
    captchaWidgetId.current = window.turnstile.render(captchaContainerRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
      callback: (token: string) => setCaptchaToken(token),
      "expired-callback": () => setCaptchaToken(null),
    })
  }, [needsCaptcha, captchaScriptReady])

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
      // The form may have been rendered while logged out and another tab
      // signed in since, with no focus/visibility event in between — check
      // once more right before signing in a second time.
      if (await checkAlreadySignedIn(sessionFetch, SESSION_CHECK_TIMEOUT_MS)) {
        window.location.replace("/")
        return
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          ...(needsCaptcha && captchaToken ? { captchaToken } : {}),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        // Server is authoritative for lockout (see app/api/auth/login/route.ts) —
        // sync to its state instead of trusting local count, so this still
        // locks correctly even if localStorage was cleared or another
        // device already tripped the counter.
        if (res.status === 423) {
          const secs = data.retryAfterSeconds ?? 60
          const until = Date.now() + secs * 1000
          setAttempts(3)
          setLockUntil(until)
          localStorage.setItem("826_login_attempts", JSON.stringify({ attempts: 3, lockUntil: until }))
          toastRef.current.error(data.error ?? "Too many failed attempts. Please wait 1 minute.")
          setIsLoading(false)
          return
        }

        // Not a failed credential guess — the server never even checked the
        // password — so this must never touch the attempt counter. Render
        // (or reset) the widget and ask for it before resubmitting.
        if (data.requireCaptcha) {
          setNeedsCaptcha(true)
          setCaptchaToken(null)
          if (captchaWidgetId.current && window.turnstile) {
            window.turnstile.reset(captchaWidgetId.current)
          }
          toastRef.current.error(data.error ?? "Please complete the verification challenge.")
          setIsLoading(false)
          return
        }

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

      // MFA is mandatory for every account — the login route never returns
      // `user` directly anymore, only a challenge to resolve next.
      if (data.mfaRequired) {
        setMfaMethod(data.method)
        setChallengeId(data.challengeId)
        setMfaCode("")
        setMfaError(null)
        setStep("mfa")
        setIsLoading(false)
        return
      }

      finishLogin(data.user)
    } catch {
      toastRef.current.error("Network error. Please try again.")
      setIsLoading(false)
    }
  }

  // Shared by the (no longer reachable, kept defensively) direct-success path
  // above and handleVerifyMfa below — stores the signed-in user and routes to
  // their dashboard, or to the forced password-change page first.
  function finishLogin(user: { role?: string; must_change_password?: boolean; email?: string | null }) {
    try {
      localStorage.setItem("826_user", JSON.stringify(user))
    } catch {
      /* ignore */
    }
    // Intentionally leave isLoading=true here — router.push() only starts
    // the navigation (the destination's auth/layout/data chain still has to
    // resolve after this call returns), so resetting it now made the
    // button flicker "Signing in…" -> "Login" -> (actual page) instead of
    // reading as one continuous wait. This page is being replaced either
    // way, so there's nothing to re-enable the button for.
    if (user?.must_change_password) {
      router.push("/change-password-required")
    } else {
      const dest = ROLE_ROUTES[user?.role ?? ""] ?? "/"
      // One-shot signal for MfaEmailReminder.tsx (mounted in the dashboard
      // shells) to show its "no MFA set up" nudge exactly once per fresh
      // login — same technique SessionEnforcement.tsx already uses for its
      // own one-shot query param, not a new mechanism. Skipped entirely
      // (not just hidden) when the account already has an email, so there's
      // nothing for that component to even check on a normal login.
      router.push(user?.email ? dest : `${dest}?justLoggedIn=1`)
    }
  }

  async function handleVerifyMfa(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaCode.trim()) {
      setMfaError("Enter the 6-digit code.")
      return
    }
    setMfaError(null)
    setMfaSubmitting(true)
    try {
      const res = await fetch("/api/auth/verify-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code: mfaCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 423) {
          const secs = data.retryAfterSeconds ?? 60
          setMfaLockUntil(Date.now() + secs * 1000)
          toastRef.current.error(data.error ?? "Too many failed attempts. Please wait 1 minute.")
          setMfaSubmitting(false)
          return
        }
        setMfaError(data.error ?? "Incorrect code. Please try again.")
        setMfaSubmitting(false)
        return
      }
      finishLogin(data.user)
    } catch {
      setMfaError("Network error. Please try again.")
      setMfaSubmitting(false)
    }
  }

  async function handleSwitchToEmail() {
    setSwitchingMethod(true)
    setMfaError(null)
    try {
      const res = await fetch("/api/auth/verify-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, switchToEmail: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMfaError(data.error ?? "Couldn't send an email code. Please try again.")
        return
      }
      setMfaMethod(data.method)
      setChallengeId(data.challengeId)
      setMfaCode("")
      toastRef.current.success("A verification code has been emailed to you.")
    } catch {
      setMfaError("Network error. Please try again.")
    } finally {
      setSwitchingMethod(false)
    }
  }

  function handleBackToCredentials() {
    setStep("credentials")
    setMfaMethod(null)
    setChallengeId(null)
    setMfaCode("")
    setMfaError(null)
    setMfaLockUntil(null)
    setMfaLockRemaining(0)
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
              if (notice) setNotice(null)
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
              if (notice) setNotice(null)
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
        <div className="mt-1.5 text-right">
          <Link href="/forgot-password" className="text-xs font-semibold text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>

      {/* Signed-out notice — persists (unlike the toast fired alongside it)
          so it's still here no matter when the person looks back at this
          tab; a background redirect, not something they just clicked. */}
      {notice && (
        <div className="flex items-start gap-2.5 rounded-xl bg-status-delayed/10 border border-status-delayed/20 px-3.5 py-2.5 text-xs font-medium text-status-delayed">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{loginRedirectNoticeCopy(notice)}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="-mr-1 -mt-0.5 shrink-0 rounded-full p-0.5 text-status-delayed/70 hover:text-status-delayed"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Post-lockout verification — only rendered once the server has told
          us this account needs it (see handleSubmit's requireCaptcha branch).
          No proactive "does this account need a captcha" check before the
          first submit — that would itself be a new way to probe which
          accounts exist. */}
      {needsCaptcha && (
        <div className="flex justify-center">
          <div ref={captchaContainerRef} />
        </div>
      )}

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
        disabled={isLoading || locked || (needsCaptcha && !captchaToken)}
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

  const mfaForm = (
    <form onSubmit={handleVerifyMfa} noValidate className="w-full space-y-5">
      <div>
        <label htmlFor="mfa-code" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-heading">
          {mfaMethod === "totp" ? "Authenticator Code" : "Verification Code"}
        </label>
        <div className="group relative">
          <ShieldAlert className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent" />
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={mfaCode}
            onChange={(e) => {
              setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              if (mfaError) setMfaError(null)
            }}
            placeholder="123456"
            autoFocus
            disabled={mfaLocked}
            className={cn(
              "h-12 w-full rounded-full border bg-surface pl-11 pr-4 text-center text-lg tracking-[0.3em] text-heading transition-all duration-200",
              "placeholder:text-muted/60 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent hover:border-slate-300",
              "disabled:cursor-not-allowed disabled:opacity-50",
              mfaError ? "border-status-delayed text-status-delayed" : "border-slate-200",
            )}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {mfaMethod === "totp"
            ? "Enter the code from your authenticator app."
            : "Enter the 6-digit code we emailed you. It expires in 10 minutes."}
        </p>
        {mfaError && <p className="mt-1.5 text-xs font-medium text-status-delayed">{mfaError}</p>}
      </div>

      {/* MFA Lockout Alert */}
      {mfaLocked && (
        <div className="flex items-center gap-2.5 rounded-xl bg-status-delayed/10 border border-status-delayed/20 px-3.5 py-2.5 text-xs font-medium text-status-delayed">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            Too many failed attempts. Returning to login in <strong>{mfaLockRemaining}s</strong>.
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={mfaSubmitting || switchingMethod || mfaLocked}
        className={cn(
          "h-12 w-full rounded-full bg-linear-to-b from-accent to-primary text-sm font-semibold text-white shadow-md cursor-pointer transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0 active:shadow-xs",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
        )}
      >
        {mfaSubmitting ? "Verifying…" : mfaLocked ? `Locked · ${mfaLockRemaining}s` : "Verify"}
      </button>

      <div className="flex flex-col items-center gap-2">
        {mfaMethod === "totp" && (
          <button
            type="button"
            onClick={handleSwitchToEmail}
            disabled={switchingMethod || mfaSubmitting || mfaLocked}
            className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
          >
            {switchingMethod ? "Sending…" : "Use email instead"}
          </button>
        )}
        <button
          type="button"
          onClick={handleBackToCredentials}
          disabled={mfaSubmitting || switchingMethod}
          className="text-xs font-semibold text-muted hover:text-heading disabled:opacity-50"
        >
          Back to login
        </button>
      </div>
    </form>
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-surface-subtle md:overflow-hidden md:bg-surface">
    {/* Loaded unconditionally but lazily — the widget itself only renders
        once the server says this account needs it, but the script needs a
        head start so it's ready by then instead of adding a visible delay
        right when the person is already mid-retry. */}
    <Script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js"
      strategy="lazyOnload"
      onLoad={() => setCaptchaScriptReady(true)}
    />
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
              {step === "mfa" ? "Verify It's You" : "Welcome Back!"}
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-400 uppercase tracking-wider">
              {step === "mfa" ? "One more step" : "Enter your credentials"}
            </p>
          </div>

          {/* Form — held back until the already-signed-in check has answered */}
          {gate !== "open" ? (
            <div aria-busy="true" aria-label="Checking your session" className="w-full animate-pulse space-y-5">
              <div className="h-11 rounded-lg bg-slate-100" />
              <div className="h-11 rounded-lg bg-slate-100" />
              <div className="h-11 rounded-lg bg-slate-200" />
            </div>
          ) : step === "mfa" ? mfaForm : form}

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
