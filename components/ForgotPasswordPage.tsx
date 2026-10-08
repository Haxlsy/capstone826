"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError("Email is required.")
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      // Always treat this as success from the UI's point of view — the
      // route itself returns the same generic message whether or not the
      // email matched an account (no-enumeration-leak, see the route).
      if (res.ok) {
        setSent(true)
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "Something went wrong. Please try again.")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-surface-subtle md:overflow-hidden md:bg-surface">
      <picture className="pointer-events-none absolute inset-0 hidden md:block">
        <source srcSet="/assets/826_car_asset.png" type="image/png" />
        <img
          src="/assets/826_car_asset.png"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute bottom-0 left-[-15%] h-full w-auto max-w-none object-contain object-bottom-left select-none xl:left-[-10%] 2xl:left-0 -translate-x-20"
        />
      </picture>

      <div className="relative flex flex-col items-center justify-center gap-2.5 bg-gradient-to-b from-primary via-teal-900 to-teal-950 px-6 pt-12 pb-14 text-center md:hidden">
        <img src="/assets/main-logo.png" alt="826" className="h-14 w-auto object-contain drop-shadow-md" />
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-100/80">
          Auto Aesthetic &amp; Protection
        </p>
      </div>

      <header className="relative z-10 hidden items-center gap-3 rounded-full bg-white px-6 py-2.5 shadow-sm border border-slate-100 md:flex w-fit ml-10 mt-6">
        <img src="/assets/main-logo.png" alt="826" className="h-5 w-auto object-contain" />
        <span className="text-sm font-semibold text-heading">Auto Aesthetic &amp; Protection</span>
      </header>

      <div className="relative z-10 flex flex-1 items-start justify-center rounded-t-4xl bg-surface px-6 md:mt-0 md:items-center md:justify-end md:rounded-none md:bg-transparent md:px-[8%] md:pb-0">
        <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 border border-slate-200/80 shadow-lg shadow-slate-200/50">
          <div className="mb-6 border-b border-slate-100 pb-5">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">Forgot Password</h1>
            <p className="mt-1 text-xs font-medium text-slate-400 uppercase tracking-wider">
              We&apos;ll email you a reset link
            </p>
          </div>

          {sent ? (
            <div className="space-y-5">
              <div className="flex items-start gap-2.5 rounded-xl bg-status-release/10 border border-status-release/20 px-3.5 py-3 text-sm text-body">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-status-release" />
                <span>
                  If that email is on file, we&apos;ve sent a password reset link. It&apos;s valid for
                  30 minutes.
                </span>
              </div>
              <Link
                href="/login"
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 text-sm font-semibold text-heading transition-colors hover:bg-surface-muted"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="w-full space-y-5">
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-heading">
                  Email
                </label>
                <div className="group relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (error) setError(null)
                    }}
                    placeholder="Enter the email on your account"
                    className={cn(
                      "h-12 w-full rounded-full border bg-surface pl-11 pr-4 text-sm text-heading transition-all duration-200",
                      "placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent hover:border-slate-300",
                      error ? "border-status-delayed text-status-delayed" : "border-slate-200",
                    )}
                  />
                </div>
                {error && <p className="mt-1.5 text-xs font-medium text-status-delayed">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "h-12 w-full rounded-full bg-linear-to-b from-accent to-primary text-sm font-semibold text-white shadow-md cursor-pointer transition-all duration-200",
                  "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/25 active:translate-y-0 active:shadow-xs",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
                )}
              >
                {isLoading ? "Sending…" : "Send Reset Link"}
              </button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted hover:text-heading"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
              </Link>
            </form>
          )}
        </div>
      </div>

      <div className="relative z-10 pb-4 text-center">
        <span className="inline-block rounded-full bg-white/80 px-4 py-1 text-[11px] font-medium text-slate-700 backdrop-blur-sm border border-white/50 shadow-xs">
          826 Auto Aesthetic &amp; Protection · Ortigas Extension
        </span>
      </div>
    </div>
  )
}
