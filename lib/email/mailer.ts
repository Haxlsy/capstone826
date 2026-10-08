import nodemailer from "nodemailer"

// Gmail SMTP via an App Password — no domain/DNS verification needed (unlike
// Resend's unverified-domain sandbox, which only delivers to the Resend
// account's own address). Sends to any recipient immediately. Lazily
// constructed so missing credentials don't crash anything at import time —
// sending is always best-effort (see sendAccountCreatedEmail), never
// something account creation depends on succeeding.
function transporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

const FROM = process.env.EMAIL_FROM ?? `"826 Auto Care" <${process.env.GMAIL_USER}>`

export interface SendResult {
  ok: boolean
  error?: string
}

async function send(to: string, subject: string, text: string, html: string): Promise<SendResult> {
  try {
    await transporter().sendMail({ from: FROM, to, subject, text, html })
    return { ok: true }
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Sends a brand-new account's username/password to their real contact email.
 * Best-effort: account creation must never fail or roll back because this
 * call failed — the caller logs/toasts on a non-ok result, nothing more.
 */
export async function sendAccountCreatedEmail(
  to: string,
  { fullName, username, password }: { fullName: string; username: string; password: string },
): Promise<SendResult> {
  return send(
    to,
    "Your 826 Auto Care account",
    `Hi ${fullName},\n\n` +
      `An account was created for you at 826 Auto Care.\n\n` +
      `Username: ${username}\n` +
      `Password: ${password}\n\n` +
      `You'll be asked to change this password the first time you sign in.\n\n` +
      `If you weren't expecting this, please contact 826 Auto Care directly.`,
    `<p>Hi ${escapeHtml(fullName)},</p>` +
      `<p>An account was created for you at 826 Auto Care.</p>` +
      `<p><strong>Username:</strong> ${escapeHtml(username)}<br>` +
      `<strong>Password:</strong> ${escapeHtml(password)}</p>` +
      `<p>You'll be asked to change this password the first time you sign in.</p>` +
      `<p>If you weren't expecting this, please contact 826 Auto Care directly.</p>`,
  )
}

/**
 * Sends a password-reset link. Best-effort, same as sendAccountCreatedEmail —
 * the caller (forgot-password route) already returns a generic response
 * regardless of send success, so there's nothing to roll back here either.
 */
export async function sendPasswordResetEmail(
  to: string,
  { fullName, resetUrl }: { fullName: string; resetUrl: string },
): Promise<SendResult> {
  return send(
    to,
    "Reset your 826 Auto Care password",
    `Hi ${fullName},\n\n` +
      `We received a request to reset your 826 Auto Care password. Use the link below ` +
      `within 30 minutes to choose a new one:\n\n${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email — your password won't change.`,
    `<p>Hi ${escapeHtml(fullName)},</p>` +
      `<p>We received a request to reset your 826 Auto Care password. Use the link below ` +
      `within 30 minutes to choose a new one:</p>` +
      `<p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>` +
      `<p>If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
  )
}

/** Sends a one-time login/password-change verification code. Best-effort. */
export async function sendMfaCodeEmail(
  to: string,
  { fullName, code }: { fullName: string; code: string },
): Promise<SendResult> {
  return send(
    to,
    `${code} is your 826 Auto Care verification code`,
    `Hi ${fullName},\n\n` +
      `Your verification code is: ${code}\n\n` +
      `It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    `<p>Hi ${escapeHtml(fullName)},</p>` +
      `<p>Your verification code is:</p>` +
      `<p style="font-size:28px;font-weight:700;letter-spacing:4px;">${escapeHtml(code)}</p>` +
      `<p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
  )
}

/** Minimal HTML-escaping for values interpolated into an email body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
