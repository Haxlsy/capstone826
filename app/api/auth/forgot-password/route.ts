import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeEmail } from "@/lib/email/validation"
import { generateToken, hashToken } from "@/lib/auth/token-hash"
import { sendPasswordResetEmail } from "@/lib/email/mailer"
import { logAudit } from "@/hooks/audit-helpers"

const GENERIC_MESSAGE = "If an account exists for that email, we've sent a password reset link."
const TOKEN_TTL_MS = 30 * 60 * 1000

// POST /api/auth/forgot-password
// Body: { email }
// Always responds with the same generic message regardless of whether the
// email matched an account — the same no-enumeration-leak principle already
// applied to the login route's archived-account timing fix. (The response
// TIME can still differ slightly between the two paths, since a real match
// also sends an email — a known, minor residual gap, not fully closed here.)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = normalizeEmail(body?.email)
    if (!email) {
      return NextResponse.json({ message: GENERIC_MESSAGE })
    }

    const admin = createAdminClient()
    const { data: account } = await admin
      .from("user_account")
      .select("id, full_name, role, is_archived")
      .eq("email", email)
      .maybeSingle()

    if (account && !account.is_archived) {
      // Invalidate any still-unused prior token for this account — at most
      // one live reset link at a time.
      await admin
        .from("password_reset_token")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", account.id)
        .is("used_at", null)

      const rawToken = generateToken()
      const { error: insertError } = await admin.from("password_reset_token").insert({
        user_id:    account.id,
        token_hash: hashToken(rawToken),
        expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      })

      if (!insertError) {
        const origin = new URL(request.url).origin
        const resetUrl = `${origin}/reset-password?token=${rawToken}`

        const emailResult = await sendPasswordResetEmail(email, {
          fullName: account.full_name,
          resetUrl,
        })
        if (!emailResult.ok) {
          console.error("sendPasswordResetEmail failed:", emailResult.error)
        }

        logAudit({
          user_id:   account.id,
          user_name: account.full_name,
          role:      account.role,
          category:  "auth",
          action:    "Requested password reset",
          target:    account.full_name,
        })
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE })
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
