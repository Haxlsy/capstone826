import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateEmail, normalizeEmail } from "@/lib/email/validation"
import { createEmailVerificationChallenge } from "@/lib/auth/email-verification"

// POST /api/auth/connect-email/start
// Body: { email }. Self-service "add/update my email for MFA" — the first
// half of a verify-then-save flow (see .../confirm/route.ts). Does NOT
// write anything to user_account yet.
export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    const cleanEmail = normalizeEmail(email)
    const emailError = validateEmail(cleanEmail, "Email")
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase    = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const admin = createAdminClient()

    // Case-insensitive uniqueness, excluding the caller's own row — same
    // pre-check pattern already used for account emails in Account Management.
    const { data: otherAccounts } = await admin.from("user_account").select("email").neq("id", user.id)
    if ((otherAccounts ?? []).some((a) => a.email && normalizeEmail(a.email) === cleanEmail)) {
      return NextResponse.json({ error: "That email is already in use by another account." }, { status: 409 })
    }

    const { data: account } = await admin
      .from("user_account")
      .select("full_name")
      .eq("id", user.id)
      .single()
    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 })
    }

    const { challengeId, emailSent } = await createEmailVerificationChallenge(admin, user.id, cleanEmail, account.full_name)
    if (!emailSent) {
      await admin.from("email_verification_challenge").update({ used_at: new Date().toISOString() }).eq("id", challengeId)
      return NextResponse.json(
        { error: "We couldn't send a verification code to that address right now. Please try again shortly." },
        { status: 500 },
      )
    }
    return NextResponse.json({ challengeId })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
