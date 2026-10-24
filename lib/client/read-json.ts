/**
 * Reads a fetch Response as JSON without ever throwing on a non-JSON body.
 *
 * When a server function is cut off (time limit) or the host rejects a
 * request, the reply is a plain-text or HTML error page, and `res.json()`
 * throws a parser error whose text reaches the user — on iPhone Safari that
 * is "The string did not match the expected pattern." This returns a clear
 * `{ error }` object instead, so callers can show it like any other error.
 */
export async function readJsonResponse<T extends object = Record<string, unknown>>(
  res: Response,
): Promise<T & { error?: string }> {
  let text = ""
  try {
    text = await res.text()
  } catch {
    // Body couldn't be read (connection dropped) — handled below as empty.
  }
  if (text) {
    try {
      return JSON.parse(text) as T & { error?: string }
    } catch {
      // Not JSON — fall through to the friendly message.
    }
  }
  return {
    error: `The upload took too long or the server had a problem (code ${res.status}). Please try again.`,
  } as T & { error?: string }
}
