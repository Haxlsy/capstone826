import type { createAdminClient } from "@/lib/supabase/admin"
import { generateMfaCode, hashMfaCode } from "@/lib/auth/mfa-challenge"
import { sendMfaCodeEmail } from "@/lib/email/mailer"

type AdminClient = ReturnType<typeof createAdminClient>

const CODE_TTL_MS = 10 * 60 * 1000

export interface EmailVerificationResult {
  challengeId: string
  emailSent: boolean
}

/**
 * Self-service "connect my email" flow (Settings), distinct from
 * lib/auth/mfa-challenge.ts's createEmailChallenge: that one sends a code to
 * an email ALREADY on the account to prove the account holder has it, for
 * login. This one sends a code to a CANDIDATE email that isn't saved yet —
 * the email only gets written to user_account once the code is confirmed
 * (see app/api/auth/connect-email/confirm/route.ts).
 */
export async function createEmailVerificationChallenge(
  admin: AdminClient,
  userId: string,
  email: string,
  fullName: string,
): Promise<EmailVerificationResult> {
  // At most one live challenge per account — same principle as every other
  // challenge table in this app.
  await admin
    .from("email_verification_challenge")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null)

  const code = generateMfaCode()
  const { data, error } = await admin
    .from("email_verification_challenge")
    .insert({
      user_id:    userId,
      email,
      code_hash:  hashMfaCode(code),
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to create verification challenge.")

  const emailResult = await sendMfaCodeEmail(email, { fullName, code })
  if (!emailResult.ok) console.error("sendMfaCodeEmail failed:", emailResult.error)

  return { challengeId: data.id, emailSent: emailResult.ok }
}
