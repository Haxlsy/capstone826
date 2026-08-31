/**
 * Canonicalises a Philippine phone number to `09XXXXXXXXX` (11 digits) so
 * differently-formatted entries (`+63…`, spaces, dashes, leading `63`) compare
 * equal and store consistently. Returns the raw digits when the shape is not a
 * recognisable PH number, and "" when there are no digits at all.
 */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("63") && digits.length === 12) return "0" + digits.slice(2)
  if (digits.length === 10) return "0" + digits
  return digits
}

/** True for a canonical PH mobile number (`09` + 9 digits). */
export function isPlausibleMobile(canonical: string): boolean {
  return /^09\d{9}$/.test(canonical)
}
