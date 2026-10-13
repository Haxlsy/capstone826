import { createHmac, timingSafeEqual } from "crypto"

const PREFIX = "sha256="

/**
 * Checks Meta's `X-Hub-Signature-256` header: an HMAC-SHA256 of the request
 * body, keyed with the Meta app's App Secret, as lowercase hex after a
 * `sha256=` prefix.
 *
 * `rawBody` must be the body exactly as received. Meta signs the escaped
 * payload it sent, so hashing a re-serialised `JSON.stringify(parsed)` gives
 * a different result.
 *
 * Pure: no env, no network.
 */
export function verifyMetaSignature(
  rawBody: string | Buffer,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!appSecret || !header || !header.startsWith(PREFIX)) return false

  const received = header.slice(PREFIX.length)
  if (!/^[0-9a-f]{64}$/i.test(received)) return false

  const expected = createHmac("sha256", appSecret).update(rawBody).digest()
  return timingSafeEqual(expected, Buffer.from(received, "hex"))
}
