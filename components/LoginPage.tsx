"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle, X, ShieldAlert } from "lucide-react"
import styles from "./LoginPage.module.css"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername]         = useState("")
  const [password, setPassword]         = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors]             = useState<{ username?: string; password?: string }>({})
  const [isLoading, setIsLoading]       = useState(false)
  const [toast, setToast]               = useState<string | null>(null)
  const [attempts, setAttempts]         = useState(0)
  const [lockUntil, setLockUntil]       = useState<number | null>(null)
  const [remaining, setRemaining]       = useState(0)
  const toastTimer                      = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    } catch { /* ignore */ }
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

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  function validate() {
    const e: { username?: string; password?: string } = {}
    if (!username.trim())
      e.username = "Username is required."
    else if (username.trim().length < 3)
      e.username = "Username must be at least 3 characters."
    if (!password)
      e.password = "Password is required."
    else if (password.length < 6)
      e.password = "Password must be at least 6 characters."
    return e
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setIsLoading(true)

    try {
      const res  = await fetch("/api/auth/login", {
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
          showToast("Too many failed attempts. Please wait 1 minute.")
        } else {
          localStorage.setItem("826_login_attempts", JSON.stringify({ attempts: next, lockUntil: null }))
          const left = 3 - next
          showToast(`Invalid credentials. ${left} attempt${left === 1 ? "" : "s"} remaining.`)
        }
        return
      }

      localStorage.removeItem("826_login_attempts")
      setAttempts(0)
      setLockUntil(null)
      try { localStorage.setItem("826_user", JSON.stringify(data.user)) } catch { }

      const roleRoutes: Record<string, string> = {
        super_admin:    "/dashboard/admin",
        admin:          "/dashboard/admin",
        operations:     "/dashboard/operations",
        sales:          "/dashboard/sales",
        head_detailer:  "/head-technician",
        head_installer: "/head-technician",
      }

      router.push(roleRoutes[data.user?.role ?? ""] ?? "/")
    } catch {
      showToast("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
    <div className={styles.page}>
      {/* Background blobs */}
      <div className={styles.flares} aria-hidden>
        <div className={`${styles.flare} ${styles.flare1}`} />
        <div className={`${styles.flare} ${styles.flare2}`} />
        <div className={`${styles.flare} ${styles.flare3}`} />
        <div className={`${styles.flare} ${styles.flare4}`} />
        <div className={`${styles.flare} ${styles.flare5}`} />
      </div>

      {/* Dot accents */}
      <div className={styles.dotTR} aria-hidden />
      <div className={styles.dotBL} aria-hidden />

      {/* Branding */}
      <header className={styles.brand}>
        <img src="/assets/826-logo.png" alt="826 Logo" className={styles.brandLogo} />
        <div className={styles.brandDivider} />
        <span className={styles.brandName}>Auto Aesthetic &amp; Protection</span>
      </header>

      {/* Card */}
      <div className={styles.card}>

        {/* Left — car image */}
        <div className={styles.imageSide}>
          <div className={styles.imageWrap}>
            <img src="/assets/car-hero-svg.svg" alt="826 Featured Car" />
          </div>
        </div>

        {/* Right — form */}
        <div className={styles.formSide}>
          <div className={styles.formHeader}>
            <h1 className={styles.title}>WELCOME BACK!</h1>
            <p className={styles.subtitle}>Please enter your credentials.</p>
            <div className={styles.underline} />
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Username */}
            <div className={styles.field}>
              <label className={styles.label}>Username</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><User size={18} /></span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (errors.username) setErrors((p) => ({ ...p, username: undefined }))
                  }}
                  placeholder="Username"
                  disabled={locked}
                  className={`${styles.input} ${errors.username ? styles.inputError : ""}`}
                />
              </div>
              {errors.username && <p className={styles.errorText}>{errors.username}</p>}
            </div>

            {/* Password */}
            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><Lock size={18} /></span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors((p) => ({ ...p, password: undefined }))
                  }}
                  placeholder="Password"
                  disabled={locked}
                  className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
                />
                <button
                  type="button"
                  className={styles.toggleBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <div className={styles.forgotRow}>
                {errors.password
                  ? <p className={styles.errorText}>{errors.password}</p>
                  : <span />}
                {/*<a href="#" className={styles.forgotLink}>Forgot password?</a>*/}
              </div>
            </div>

            {locked && (
              <div className={styles.lockBanner}>
                <ShieldAlert size={15} />
                <span>Too many failed attempts. Try again in <strong>{remaining}s</strong>.</span>
              </div>
            )}

            <button type="submit" disabled={isLoading || locked} className={styles.submitBtn}>
              {isLoading ? "…" : locked ? `Locked · ${remaining}s` : <><span>Login</span><LogIn size={18} /></>}
            </button>
          </form>
        </div>
      </div>

    </div>

    {/* Toast notification */}
    {toast && (
      <div className={styles.toast}>
        <AlertCircle size={16} className={styles.toastIcon} />
        <span>{toast}</span>
        <button type="button" onClick={() => setToast(null)} className={styles.toastClose} aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    )}

    {/* Status badge — outside .page so fixed positioning isn't clipped by overflow-x: hidden */}
    <div className={styles.badge}>
      <div className={styles.badgeDot} />
      <span className={styles.badgeText}>826 Auto Aesthetic &amp; Protection · Ortigas Extension</span>
    </div>
    </>
  )
}
