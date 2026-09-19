import { UNKNOWN_MESSENGER_NAME } from "@/types/chatbot"

const GRAPH_API_URL = "https://graph.facebook.com/v19.0/me/messages"

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
          recipient: { id: psid },
          message:   { text, quick_replies: replies },
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
 * Sends a text message to a Messenger user via the Facebook Graph API.
 * Returns the Facebook message id (mid) on success, or null on failure.
 */
export async function sendMessengerText(
  psid: string,
  text: string
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
          recipient: { id: psid },
          message:   { text },
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
 * Sends an image attachment to a Messenger user via the Facebook Graph API.
 * Returns the Facebook message id (mid) on success, or null on failure.
 * Never throws.
 */
export async function sendMessengerImage(
  psid: string,
  imageUrl: string
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
  videoUrl: string
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
      `https://graph.facebook.com/${psid}?fields=name,profile_pic&access_token=${token}`
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
