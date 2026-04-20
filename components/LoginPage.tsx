"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, Lock, Eye, EyeOff, LogIn } from "lucide-react"

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

      try {
        localStorage.setItem("826_user", JSON.stringify(data.user))
      } catch {}

      const roleRoutes: Record<string, string> = {
        super_admin: "/dashboard/admin",
        admin: "/dashboard/admin",
        operations: "/dashboard/operations",
        sales: "/dashboard/sales",
        head_detailer: "/head-technician",
        head_installer: "/head-technician",
      }

      const role: string = data.user?.role ?? ""
      router.push(roleRoutes[role] ?? "/")
    } catch {
      setServerError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ─────────────────────────────────────────
           ROOT — animated gradient background
        ───────────────────────────────────────── */
        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
          /* base colour */
          background: #dfe4e8;
        }

        /* The big moving teal light — single pseudo-like div */
        .bg-light {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 60% at 0% 50%, rgba(0,210,190,0.62) 0%, transparent 65%),
            radial-gradient(ellipse 55% 55% at 100% 55%, rgba(0,200,180,0.50) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 50% 100%, rgba(0,190,170,0.28) 0%, transparent 60%);
          animation: bgShift 8s ease-in-out infinite alternate;
          will-change: background-position, opacity;
          pointer-events: none;
          z-index: 0;
        }

        @keyframes bgShift {
          0% {
            background:
              radial-gradient(ellipse 70% 60% at 0% 50%, rgba(0,210,190,0.62) 0%, transparent 65%),
              radial-gradient(ellipse 55% 55% at 100% 55%, rgba(0,200,180,0.50) 0%, transparent 60%),
              radial-gradient(ellipse 40% 40% at 50% 100%, rgba(0,190,170,0.28) 0%, transparent 60%);
          }
          25% {
            background:
              radial-gradient(ellipse 75% 65% at 5% 40%, rgba(0,218,200,0.68) 0%, transparent 65%),
              radial-gradient(ellipse 50% 50% at 95% 60%, rgba(0,190,175,0.42) 0%, transparent 60%),
              radial-gradient(ellipse 45% 45% at 55% 95%, rgba(0,200,185,0.32) 0%, transparent 60%);
          }
          50% {
            background:
              radial-gradient(ellipse 65% 70% at 2% 60%, rgba(0,200,185,0.55) 0%, transparent 65%),
              radial-gradient(ellipse 60% 58% at 98% 45%, rgba(0,215,195,0.55) 0%, transparent 60%),
              radial-gradient(ellipse 38% 38% at 45% 98%, rgba(0,180,165,0.25) 0%, transparent 60%);
          }
          75% {
            background:
              radial-gradient(ellipse 72% 62% at -2% 55%, rgba(0,222,202,0.65) 0%, transparent 65%),
              radial-gradient(ellipse 52% 52% at 102% 50%, rgba(0,205,188,0.48) 0%, transparent 60%),
              radial-gradient(ellipse 42% 42% at 52% 102%, rgba(0,195,178,0.30) 0%, transparent 60%);
          }
          100% {
            background:
              radial-gradient(ellipse 68% 58% at 3% 45%, rgba(0,208,188,0.58) 0%, transparent 65%),
              radial-gradient(ellipse 58% 56% at 97% 58%, rgba(0,212,192,0.52) 0%, transparent 60%),
              radial-gradient(ellipse 36% 36% at 48% 96%, rgba(0,185,168,0.26) 0%, transparent 60%);
          }
        }

        /* Dot pattern top-right */
        .dots {
          position: absolute;
          pointer-events: none;
          z-index: 1;
          opacity: 0.45;
          background-image: radial-gradient(circle, #009e8e 1.4px, transparent 1.4px);
          background-size: 13px 13px;
        }
        .dots-tr { top: 8px; right: 36px; width: 180px; height: 140px; }
        .dots-br { bottom: 8px; right: 8px; width: 160px; height: 110px; }

        /* ─────────────────────────────────────────
           BRAND BAR
        ───────────────────────────────────────── */
        .brand-bar {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 32px;
        }
        /* Logo image — replace src with /assets/826-logo.png */
        .brand-logo {
          height: 36px;   /* bigger than before */
          width: auto;
          object-fit: contain;
        }
        .brand-divider {
          width: 1px;
          height: 20px;
          background: rgba(0,0,0,0.20);
        }
        .brand-text {
          font-size: 14px;
          font-weight: 400;
          color: rgba(0,0,0,0.52);
          letter-spacing: 0.04em;
        }

        /* ─────────────────────────────────────────
           CARD WRAPPER  (handles overflow:visible)
        ───────────────────────────────────────── */
        .card-wrapper {
          position: relative;
          z-index: 10;
          width: min(980px, 94vw);
          /* Extra left padding so car can bleed left */
          padding-left: 0;
        }

        /* The white card itself */
        .card {
          display: flex;
          min-height: 420px;
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(255,255,255,1);
          border-radius: 28px;
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          overflow: visible;          /* ← allow car to bleed out */
          box-shadow:
            0 10px 50px rgba(0,0,0,0.10),
            0 2px 10px rgba(0,0,0,0.06);
          /* push content right so left side is free for car */
          padding-left: 360px;        /* reserve space for car column */
        }

        /* ─────────────────────────────────────────
           CAR — absolutely positioned, bleeds above card
        ───────────────────────────────────────── */
        .car-col {
          position: absolute;
          left: -10px;                /* slight bleed to the left of card */
          bottom: 0;
          width: 400px;
          z-index: 20;
          pointer-events: none;
        }
        /* Rounded rect bg behind the car photo */
        .car-photo-wrap {
          width: 100%;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.14);
          /* rises above card top */
          margin-bottom: 0;
          position: relative;
          top: -30px;                 /* bleeds upward out of card */
        }
        .car-photo-wrap img {
          display: block;
          width: 100%;
          height: 420px;
          object-fit: cover;
          object-position: center 30%;
        }

        /* ─────────────────────────────────────────
           FORM PANEL
        ───────────────────────────────────────── */
        .form-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 52px 52px 52px 32px;
        }

        .form-title {
          font-family: 'Rajdhani', sans-serif;
          font-size: 42px;
          font-weight: 700;
          color: #111;
          line-height: 1.0;
          letter-spacing: 0.01em;
          margin-bottom: 6px;
        }
        .form-sub {
          font-size: 13.5px;
          color: rgba(0,0,0,0.42);
          margin-bottom: 4px;
          font-weight: 300;
        }
        .title-rule {
          width: 100%;
          height: 1.5px;
          background: linear-gradient(90deg, #00c8b8 0%, rgba(0,200,184,0.08) 100%);
          margin-bottom: 26px;
          margin-top: 8px;
        }

        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: rgba(0,0,0,0.56);
          margin-bottom: 8px;
        }
        .input-wrap { position: relative; }
        .input-icon {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(0,0,0,0.24);
          width: 15px;
          height: 15px;
          pointer-events: none;
        }
        .field-input {
          width: 100%;
          padding: 12px 14px 12px 42px;
          background: rgba(255,255,255,0.9);
          border: 1.5px solid rgba(0,0,0,0.10);
          border-radius: 999px;
          color: #111;
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input::placeholder { color: rgba(0,0,0,0.24); }
        .field-input:focus {
          border-color: #00c8b8;
          box-shadow: 0 0 0 3px rgba(0,200,184,0.12);
        }
        .field-input.error { border-color: #e05555; }

        .eye-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(0,0,0,0.28);
          display: flex;
          align-items: center;
          transition: color 0.15s;
          padding: 2px;
        }
        .eye-btn:hover { color: rgba(0,0,0,0.58); }

        .field-error { font-size: 11px; color: #e05555; margin-top: 5px; padding-left: 6px; }
        .field-group { margin-bottom: 18px; }

        .forgot-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .forgot-btn {
          background: none; border: none;
          font-size: 11.5px; color: #00a896;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          font-weight: 500; padding: 0;
          transition: color 0.15s;
        }
        .forgot-btn:hover { color: #007a6e; }

        .server-error { font-size: 12px; color: #e05555; margin-bottom: 12px; }

        /* Login button — left aligned, pill shaped */
        .submit-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 38px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #00d4be 0%, #00a896 100%);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 22px rgba(0,200,184,0.38);
          margin-top: 10px;
        }
        .submit-btn:hover:not(:disabled) {
          opacity: 0.88;
          box-shadow: 0 6px 30px rgba(0,200,184,0.46);
          transform: translateY(-1px);
        }
        .submit-btn:active:not(:disabled) { transform: scale(0.97); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ─────────────────────────────────────────
           WORKSHOP BADGE
        ───────────────────────────────────────── */
        .workshop-badge {
          position: fixed;
          bottom: 16px; right: 16px;
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.82);
          border: 1px solid rgba(0,0,0,0.09);
          border-radius: 999px;
          padding: 6px 14px;
          backdrop-filter: blur(10px);
          z-index: 50;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }
        .badge-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #00c8b8;
          animation: pulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.38; transform: scale(0.76); }
        }
        .badge-text {
          font-size: 11px; font-weight: 500;
          letter-spacing: 0.12em; color: rgba(0,0,0,0.44);
          text-transform: uppercase;
        }

        @media (max-width: 700px) {
          .car-col { display: none; }
          .card { padding-left: 0; }
          .form-panel { padding: 40px 28px; }
        }
      `}</style>

      <div className="login-root">
        {/* Animated background light */}
        <div className="bg-light" />

        {/* Dot patterns */}
        <div className="dots dots-tr" />
        <div className="dots dots-br" />

        {/* Brand bar */}
        <div className="brand-bar">
          {/* ↓ Replace with your actual asset path */}
          <img src="/assets/826-logo.png" alt="826" className="brand-logo" />
          <div className="brand-divider" />
          <span className="brand-text">Auto Aesthetic &amp; Protection</span>
        </div>

        {/* Card wrapper — overflow visible so car bleeds */}
        <div className="card-wrapper">

          {/* Car — absolutely positioned, overlaps card */}
          <div className="car-col">
            <div className="car-photo-wrap">
              {/* ↓ Replace with your actual asset path */}
              <img src="/assets/car-hero.png" alt="826 Featured Vehicle" />
            </div>
          </div>

          {/* White card */}
          <div className="card">
            <div className="form-panel">
              <h1 className="form-title">WELCOME BACK!</h1>
              <p className="form-sub">Please enter your credentials.</p>
              <div className="title-rule" />

              <form onSubmit={handleSubmit} noValidate>
                {/* Username */}
                <div className="field-group">
                  <label className="field-label">Username</label>
                  <div className="input-wrap">
                    <User className="input-icon" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value)
                        if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }))
                      }}
                      placeholder="Username"
                      className={`field-input${errors.username ? " error" : ""}`}
                    />
                  </div>
                  {errors.username && <p className="field-error">{errors.username}</p>}
                </div>

                {/* Password */}
                <div className="field-group">
                  <div className="forgot-row">
                    <label className="field-label" style={{ marginBottom: 0 }}>Password</label>
                    <button type="button" className="forgot-btn">Forgot password?</button>
                  </div>
                  <div className="input-wrap" style={{ marginTop: 8 }}>
                    <Lock className="input-icon" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                      }}
                      placeholder="Password"
                      className={`field-input${errors.password ? " error" : ""}`}
                      style={{ paddingRight: 42 }}
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && <p className="field-error">{errors.password}</p>}
                </div>

                {serverError && <p className="server-error">{serverError}</p>}

                {/* Left-aligned login button */}
                <button type="submit" disabled={isLoading} className="submit-btn">
                  {isLoading ? "Signing in…" : <><span>Login</span><LogIn size={15} /></>}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Workshop badge */}
        <div className="workshop-badge">
          <div className="badge-dot" />
          <span className="badge-text">Workshop Alpha · 826 HQ</span>
        </div>
      </div>
    </>
  )
}