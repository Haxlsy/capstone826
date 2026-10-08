import { createHash, randomInt } from "crypto"
import type { createAdminClient } from "@/lib/supabase/admin"
import { sendMfaCodeEmail } from "@/lib/email/mailer"

type AdminClient = ReturnType<typeof createAdminClient>

const CODE_TTL_MS = 10 * 60 * 1000
export const MAX_MFA_ATTEMPTS = 5

/** A random, zero-padded 6-digit code — "012345" is as valid as "839201". */
export function generateMfaCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

export function hashMfaCode(code: string): string {
  return createHash("sha256").update(code).digest("hex")
}

/** At most one live challenge per account — a fresh one supersedes any prior unused one. */
async function invalidatePriorChallenges(admin: AdminClient, userId: string) {
  await admin
    .from("login_mfa_challenge")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null)
}

export interface MfaChallengeResult {
  challengeId: string
  method: "email" | "totp"
}

/**
 * Creates a fresh TOTP challenge row. The actual code check is delegated to
 * Supabase's own auth.mfa.challenge/verify at verify time (verify-mfa route)
 * — this row only records which factor/account it's for and bounds its
 * lifetime/attempt count the same way the email method does.
 */
export async function createTotpChallenge(
  admin: AdminClient,
  userId: string,
  factorId: string,
): Promise<MfaChallengeResult> {
  await invalidatePriorChallenges(admin, userId)
  const { data, error } = await admin
    .from("login_mfa_challenge")
    .insert({
      user_id:    userId,
      method:     "totp",
      factor_id:  factorId,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to create MFA challenge.")
  return { challengeId: data.id, method: "totp" }
}

/**
 * Creates a fresh email-code challenge and sends the code. Best-effort on
 * the send — the challenge row exists regardless, so the caller can surface
 * emailSent:false without failing the whole login.
 */
export async function createEmailChallenge(
  admin: AdminClient,
  userId: string,
  email: string,
  fullName: string,
): Promise<MfaChallengeResult & { emailSent: boolean }> {
  await invalidatePriorChallenges(admin, userId)
  const code = generateMfaCode()
  const { data, error } = await admin
    .from("login_mfa_challenge")
    .insert({
      user_id:    userId,
      method:     "email",
      code_hash:  hashMfaCode(code),
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to create MFA challenge.")

  const emailResult = await sendMfaCodeEmail(email, { fullName, code })
  if (!emailResult.ok) console.error("sendMfaCodeEmail failed:", emailResult.error)

  return { challengeId: data.id, method: "email", emailSent: emailResult.ok }
}
