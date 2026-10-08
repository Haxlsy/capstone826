import { createHash, randomUUID } from "crypto"

/** A random, URL-safe token for a one-time link (password reset, etc.). */
export function generateToken(): string {
  return randomUUID() + randomUUID()
}

/**
 * SHA-256 hash of a raw token, for storage. Never store the raw token itself —
 * only this hash, so a database read alone can never hand out a usable link.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}
