import { UNKNOWN_MESSENGER_NAME } from "@/types/chatbot"

// Meta retires each Graph API version about two years after release (v19.0,
// used here before, expired on 21 May 2026). Check the dates at
// https://developers.facebook.com/docs/graph-api/changelog/versions and bump
// this before the current one runs out.
const GRAPH_API_VERSION = "v26.0"
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`
const GRAPH_API_URL = `${GRAPH_API_BASE}/me/messages`

/**
 * `RESPONSE` answers a message the customer just sent; `UPDATE` is a message
 * the shop starts on its own (stage done, ready for release). Both are only
 * accepted inside Meta's 24-hour window, counted from the customer's last
 * message to the Page.
 */
export type MessagingType = "RESPONSE" | "UPDATE"

export type MessengerSendErrorKind = "window_closed" | "token" | "permission" | "unknown"

export interface MessengerSendError {
  kind: MessengerSendErrorKind
  code: number | null
  subcode: number | null
  message: string
}

/**
 * Sorts a Graph API error body into the few cases staff can act on. Pure.
 *
 * - window_closed: more than 24 hours since the customer's last message
 *   (error 1545041, or code 10 with subcode 2018278).
 * - token: the Page access token is expired, revoked or invalid (code 190).
 * - permission: the app lacks `pages_messaging` for this Page or person
 *   (codes 10 and 200). In Development mode this is also what a customer
 *   with no role on the app or Page produces.
 */
export function classifyGraphError(body: unknown): MessengerSendError {
  const err = (body as { error?: Record<string, unknown> } | null)?.error ?? {}
  const code = typeof err.code === "number" ? err.code : null
  const subcode = typeof err.error_subcode === "number" ? err.error_subcode : null
  const message = typeof err.message === "string" ? err.message : "Unknown Messenger API error."

  let kind: MessengerSendErrorKind = "unknown"
  if (code === 1545041 || subcode === 1545041 || subcode === 2018278) kind = "window_closed"
  else if (code === 190) kind = "token"
  else if (code === 10 || code === 200) kind = "permission"

  return { kind, code, subcode, message }
}

/** What to tell staff when a customer update could not be delivered. */
export function describeSendError(error: MessengerSendError | null): string {
  switch (error?.kind) {
    case "window_closed":
      return (
        "The customer has not messaged the Page in the last 24 hours, so Messenger blocked this update. " +
        "Ask them to send any message to the Page, then resend."
      )
    case "token":
      return "The Page access token has expired or was revoked. Generate a new one and update META_PAGE_ACCESS_TOKEN."
    case "permission":
      return "Messenger refused the message: the app is not allowed to message this person on this Page."
    default:
      return "Messenger API returned an error."
  }
}

export interface MessengerQuickReply {
  content_type: "text"
  title: string
  payload?: string
  image_url?: string
}

/**
 * Sends a text message with tappable quick-reply buttons below it.
 * Returns the Facebook message id (mid) on success, or null on failure.
 */
export async function sendMessengerQuickReply(
  psid: string,
  text: string,
  replies: MessengerQuickReply[]
): Promise<string | null> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token || !psid) return null

  try {
    const res = await fetch(
      `${GRAPH_API_URL}?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient:      { id: psid },
          messaging_type: "RESPONSE",
          message:        { text, quick_replies: replies },
        }),
      }
    )

    if (!res.ok) return null
    const json = await res.json().catch(() => null)
    return json?.message_id ?? null
  } catch {
    return null
  }
}

/**
 * Sends a text message and reports why it failed, if it did. Use this where
 * staff need the reason (e.g. Operations' "Resend stage update"); everywhere
 * else `sendMessengerText` is enough. Never throws.
 */
export async function sendMessengerTextDetailed(
  psid: string,
  text: string,
  messagingType: MessagingType = "RESPONSE"
): Promise<{ mid: string | null; error: MessengerSendError | null }> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token || !psid) return { mid: null, error: null }

  try {
    const res = await fetch(
      `${GRAPH_API_URL}?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient:      { id: psid },
          messaging_type: messagingType,
          message:        { text },
        }),
      }
    )

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const error = classifyGraphError(json)
      console.error("[messenger/graph] sendMessengerText failed:", res.status, error.kind, error.code, error.subcode, error.message)
      return { mid: null, error }
    }
    return { mid: json?.message_id ?? null, error: null }
  } catch (err) {
    console.error("[messenger/graph] sendMessengerText threw:", err)
    return { mid: null, error: { kind: "unknown", code: null, subcode: null, message: String(err) } }
  }
}

/**
 * Sends a text message to a Messenger user via the Facebook Graph API.
 * Returns the Facebook message id (mid) on success, or null on failure.
 */
export async function sendMessengerText(
  psid: string,
  text: string,
  messagingType: MessagingType = "RESPONSE"
): Promise<string | null> {
  return (await sendMessengerTextDetailed(psid, text, messagingType)).mid
}

/**
 * Sends an image attachment to a Messenger user via the Facebook Graph API.
 * Returns the Facebook message id (mid) on success, or null on failure.
 * Never throws.
 */
export async function sendMessengerImage(
  psid: string,
  imageUrl: string,
  messagingType: MessagingType = "RESPONSE"
): Promise<string | null> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token || !psid || !imageUrl) return null

  try {
    const res = await fetch(
      `${GRAPH_API_URL}?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: psid },
          messaging_type: messagingType,
          message: {
            attachment: {
              type:    "image",
              payload: { url: imageUrl, is_reusable: true },
            },
          },
        }),
      }
    )

    if (!res.ok) {
      console.error("[messenger/graph] sendMessengerImage failed:", res.status, await res.text().catch(() => ""))
      return null
    }
    const json = await res.json().catch(() => null)
    return json?.message_id ?? null
  } catch (err) {
    console.error("[messenger/graph] sendMessengerImage threw:", err)
    return null
  }
}

/**
 * Sends a video attachment to a Messenger user via the Facebook Graph API.
 * Returns the Facebook message id (mid) on success, or null on failure.
 * Never throws.
 *
 * Facebook only reliably fetches a URL-attached video under ~25MB — this is
 * why the technician stage-video upload cap is 20MB (see the stage-media
 * upload route), rather than building the chunked/resumable upload API a
 * larger file would require.
 */
export async function sendMessengerVideo(
  psid: string,
  videoUrl: string,
  messagingType: MessagingType = "RESPONSE"
): Promise<string | null> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token || !psid || !videoUrl) return null

  try {
    const res = await fetch(
      `${GRAPH_API_URL}?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: psid },
          messaging_type: messagingType,
          message: {
            attachment: {
              type:    "video",
              payload: { url: videoUrl, is_reusable: true },
            },
          },
        }),
      }
    )

    if (!res.ok) {
      console.error("[messenger/graph] sendMessengerVideo failed:", res.status, await res.text().catch(() => ""))
      return null
    }
    const json = await res.json().catch(() => null)
    return json?.message_id ?? null
  } catch (err) {
    console.error("[messenger/graph] sendMessengerVideo threw:", err)
    return null
  }
}

/**
 * Sends a "sender action" — `typing_on`/`typing_off` toggle the typing
 * indicator in the customer's Messenger thread, `mark_seen` shows the read
 * receipt. Facebook auto-clears `typing_on` as soon as a message is sent to
 * the recipient (or after ~20s), so callers don't need to pair it with an
 * explicit `typing_off` before their reply. Never throws — a failure here
 * must not affect message delivery.
 */
export async function sendSenderAction(
  psid: string,
  action: "typing_on" | "typing_off" | "mark_seen"
): Promise<void> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token || !psid) return

  try {
    const res = await fetch(
      `${GRAPH_API_URL}?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient:     { id: psid },
          sender_action: action,
        }),
      }
    )

    if (!res.ok) {
      console.error("[messenger/graph] sendSenderAction failed:", res.status, await res.text().catch(() => ""))
    }
  } catch (err) {
    console.error("[messenger/graph] sendSenderAction threw:", err)
  }
}

/**
 * Fetches the public profile (name + profile_pic) for a Messenger PSID.
 */
export async function fetchMessengerProfile(psid: string): Promise<{
  name: string
  profile_pic: string | null
}> {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) return { name: UNKNOWN_MESSENGER_NAME, profile_pic: null }

  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${psid}?fields=name,profile_pic&access_token=${token}`
    )
    const json = await res.json().catch(() => null)
    return {
      name:        json?.name ?? UNKNOWN_MESSENGER_NAME,
      profile_pic: json?.profile_pic ?? null,
    }
  } catch {
    return { name: UNKNOWN_MESSENGER_NAME, profile_pic: null }
  }
}
