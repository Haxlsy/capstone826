"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, Lock, Eye, EyeOff, LogIn } from "lucide-react"
import styles from "./LoginPage.module.css"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername]         = useState("")
  const [password, setPassword]         = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors]             = useState<{ username?: string; password?: string }>({})
  const [serverError, setServerError]   = useState<string | null>(null)
  const [isLoading, setIsLoading]       = useState(false)

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
    setServerError(null)
    setIsLoading(true)

    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()

      if (!res.ok) { setServerError(data.error ?? "Something went wrong."); return }

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
      setServerError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Background blobs */}
      <div className={styles.flares} aria-hidden>
        <div className={`${styles.flare} ${styles.flare1}`} />
        <div className={`${styles.flare} ${styles.flare2}`} />
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
            <img src="/assets/car-hero.png" alt="826 Featured Car" />
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
                <a href="#" className={styles.forgotLink}>Forgot password?</a>
              </div>
              {errors.password && <p className={styles.errorText}>{errors.password}</p>}
            </div>

            {serverError && <p className={styles.serverError}>{serverError}</p>}

            <button type="submit" disabled={isLoading} className={styles.submitBtn}>
              {isLoading ? "…" : <><span>Login</span><LogIn size={18} /></>}
            </button>
          </form>
        </div>
      </div>

      {/* Status badge */}
      <div className={styles.badge}>
        <div className={styles.badgeDot} />
        <span className={styles.badgeText}>Workshop Alpha · 826 HQ</span>
      </div>
    </div>
  )
}
