import { stripInvisibleDeep } from "@/lib/text"

/**
 * Body fields passed through untouched: secrets must reach the server exactly
 * as typed, or someone whose password happens to contain one of these
 * characters would be locked out.
 */
const SECRET_KEYS = ["password", "currentPassword", "newPassword", "code", "token", "otp"] as const

/**
 * `await request.json()` with every string cleaned of invisible characters
 * (e.g. the Hangul filler "ㅤ" used for "blank" names in games), so no API route
 * can store a value that looks empty. Runs before each route's own checks, so a
 * value made only of such characters becomes "" and hits the usual "required".
 */
// Typed like request.json() (any) so it drops into every route unchanged;
// each route still validates the body itself.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJsonBody(request: Request): Promise<any> {
  return stripInvisibleDeep(await request.json(), { skipKeys: SECRET_KEYS })
}
