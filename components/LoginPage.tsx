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
      } catch { }

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
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Rajdhani:wght@600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --teal-primary: #00d2be;
          --teal-secondary: #00a896;
          --bg-base: #f0f4f7;
          --card-bg: rgba(255, 255, 255, 0.82);
          --text-main: #111;
          --text-muted: #555;
        }

        body {
          font-family: 'Outfit', sans-serif;
          background: var(--bg-base);
          color: var(--text-main);
          overflow-x: hidden;
        }

        .login-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 20px;
        }

        /* Flare Lights */
        .flare-container {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .flare {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.45;
        }
        .flare-1 {
          width: min(80vw, 800px);
          height: min(80vw, 800px);
          background: radial-gradient(circle, var(--teal-primary) 0%, transparent 70%);
          top: -10%; left: -5%;
          animation: drift 20s infinite alternate ease-in-out;
        }
        .flare-2 {
          width: min(70vw, 700px);
          height: min(70vw, 700px);
          background: radial-gradient(circle, #0096ff 0%, transparent 70%);
          bottom: -15%; right: -5%;
          animation: drift 25s infinite alternate-reverse ease-in-out;
        }
        @keyframes drift {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(40px, 20px) scale(1.05); }
        }

        /* Dots */
        .dot-pattern {
          position: absolute;
          width: 200px;
          height: 150px;
          background-image: radial-gradient(var(--teal-primary) 1.5px, transparent 1.5px);
          background-size: 15px 15px;
          opacity: 0.25;
          z-index: 1;
        }
        .dot-tr { top: 20px; right: 20px; }
        .dot-bl { bottom: 20px; left: 20px; }

        /* Branding Header */
        .branding-header {
          position: fixed;
          top: 40px;
          left: 50px;
          display: flex;
          align-items: center;
          gap: 20px;
          z-index: 100;
        }
        .logo-img { height: 64px; width: auto; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.12)); }
        .logo-divider { width: 2px; height: 40px; background: rgba(0,0,0,0.12); }
        .branding-text { font-size: 22px; font-weight: 600; color: #000; letter-spacing: -0.5px; }

        /* Main Card */
        .login-card {
          width: 100%;
          max-width: 1080px;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          background: var(--card-bg);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border-radius: 48px;
          box-shadow: 0 32px 100px -20px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          z-index: 10;
          border: 1px solid rgba(255, 255, 255, 0.8);
          position: relative;
        }

        /* Left Side: Car Image */
        .image-side {
          padding: 24px;
          display: flex;
        }
        .car-image-container {
          width: auto;
          height: 100%;
          min-height: 620px;
          max-height: 800px
          border-radius: 40px;
          overflow: hidden;
          position: relative;
          background: transparent;
        }
        .car-image-container img {
          width: auto;
          height: 100%;
          object-fit: contain;
          object-position: 0% center; /* Align to the car side of the image */
          transform: scale(1.0); /* Slight zoom to focus on the car */
        }

        /* Right Side: Form */
        .form-side {
          padding: 64px 64px 64px 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .form-header { margin-bottom: 32px; }
        .welcome-title { font-family: 'Rajdhani', sans-serif; font-size: 48px; font-weight: 700; color: #111; line-height: 1; margin-bottom: 8px; }
        .credentials-text { font-size: 16px; color: var(--text-muted); margin-bottom: 16px; }
        .title-underline { width: 100%; height: 2px; background: var(--teal-primary); opacity: 0.6; }

        .input-group { margin-bottom: 24px; }
        .input-label { display: block; font-size: 14px; font-weight: 600; color: #444; margin-bottom: 10px; }
        .input-box-wrapper { position: relative; }
        .box-icon { position: absolute; left: 20px; top: 50%; transform: translateY(-50%); color: #999; }
        .login-input {
          width: 100%;
          padding: 16px 20px 16px 56px;
          background: #fff;
          border: 1.5px solid transparent;
          border-radius: 20px;
          font-size: 16px;
          color: #000;
          transition: all 0.3s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02), inset 0 2px 4px rgba(0,0,0,0.01);
        }
        .login-input:focus {
          outline: none;
          border-color: var(--teal-primary);
          box-shadow: 0 8px 24px rgba(0, 210, 190, 0.12);
          transform: translateY(-1px);
        }
        .login-input.has-error { border-color: #ff4d4f; }

        .pass-toggle {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #bbb;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .pass-toggle:hover { color: var(--teal-secondary); }

        .forgot-password { display: block; text-align: right; margin-top: 10px; font-size: 14px; color: #00897b; text-decoration: none; font-weight: 600; }
        .forgot-password:hover { color: var(--teal-primary); text-decoration: underline; }

        .login-submit-btn {
          width: 150px;
          padding: 16px;
          margin-top: 24px;
          background: linear-gradient(135deg, var(--teal-primary), var(--teal-secondary));
          color: #fff;
          border: none;
          border-radius: 24px;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 10px 20px rgba(0, 210, 190, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .login-submit-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 15px 30px rgba(0, 210, 190, 0.4);
        }
        .login-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .error-hint { color: #f43f5e; font-size: 13px; margin-top: 8px; font-weight: 600; }

        /* Status Badge */
        .status-badge {
          position: fixed;
          bottom: 24px; right: 24px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(8px);
          padding: 8px 16px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          z-index: 100;
          border: 1px solid rgba(0,0,0,0.05);
        }
        .status-pulse { width: 8px; height: 8px; background: var(--teal-primary); border-radius: 50%; animation: pulse-anim 2s infinite; }
        @keyframes pulse-anim { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.8); } }
        .status-text { font-size: 11px; font-weight: 700; color: #777; text-transform: uppercase; letter-spacing: 0.05em; }

        @media (max-width: 1024px) {
          .login-card { grid-template-columns: 1fr; max-width: 500px; }
          .image-side { display: none; }
          .form-side { padding: 48px; }
          .branding-header { top: 20px; left: 20px; }
          .status-badge { bottom: 16px; right: 16px; }
        }
      `}</style>

      <div className="login-page">
        {/* Background Lights */}
        <div className="flare-container">
          <div className="flare flare-1" />
          <div className="flare flare-2" />
        </div>

        {/* Dots */}
        <div className="dot-pattern dot-tr" />
        <div className="dot-pattern dot-bl" />

        {/* Logo Header */}
        <div className="branding-header">
          <img src="/assets/826-logo.png" alt="826 Logo" className="logo-img" />
          <div className="logo-divider" />
          <span className="branding-text">Auto Aesthetic & Protection</span>
        </div>
        <div className="image-side">
          <div className="car-image-container">
            <img src="/assets/car-hero.png" alt="826 Featured Car" />
          </div>
        </div>
        {/* Interaction Card */}
        <div className="login-card">
          {/* Left Column: Display Image */}


          {/* Right Column: Auth Form */}
          <div className="form-side">
            <div className="form-header">
              <h1 className="welcome-title">WELCOME BACK!</h1>
              <p className="credentials-text">Please enter your credentials.</p>
              <div className="title-underline" />
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="input-group">
                <label className="input-label">Username</label>
                <div className="input-box-wrapper">
                  <User className="box-icon" size={20} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }))
                    }}
                    placeholder="Username"
                    className={`login-input ${errors.username ? "has-error" : ""}`}
                  />
                </div>
                {errors.username && <p className="error-hint">{errors.username}</p>}
              </div>

              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-box-wrapper">
                  <Lock className="box-icon" size={20} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                    }}
                    placeholder="Password"
                    className={`login-input ${errors.password ? "has-error" : ""}`}
                  />
                  <button
                    type="button"
                    className="pass-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <a href="#" className="forgot-password">Forgot password?</a>
                {errors.password && <p className="error-hint">{errors.password}</p>}
              </div>

              {serverError && <p className="error-hint" style={{ marginBottom: '15px' }}>{serverError}</p>}

              <button type="submit" disabled={isLoading} className="login-submit-btn">
                {isLoading ? "..." : <><span>Login</span><LogIn size={20} /></>}
              </button>
            </form>
          </div>
        </div>

        {/* Status Badge */}
        <div className="status-badge">
          <div className="status-pulse" />
          <span className="status-text">Workshop Alpha · 826 HQ</span>
        </div>
      </div>
    </>
  )
}