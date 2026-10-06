const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

/**
 * Verifies a Cloudflare Turnstile token server-side. Used to gate login
 * attempts once an account has been locked out once (see
 * app/api/auth/login/route.ts) — never trusts a client-reported "I solved
 * it," always confirms with Cloudflare first.
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set — failing closed.")
    return false
  }

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp) body.set("remoteip", remoteIp)

    const res = await fetch(VERIFY_URL, { method: "POST", body })
    if (!res.ok) return false

    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (err) {
    console.error("[turnstile] verify request failed:", err)
    return false
  }
}
