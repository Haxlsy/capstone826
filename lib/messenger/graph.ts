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

    if (!res.ok) return null
    const json = await res.json().catch(() => null)
    return json?.message_id ?? null
  } catch {
    return null
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
  if (!token) return { name: "Messenger User", profile_pic: null }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${psid}?fields=name,profile_pic&access_token=${token}`
    )
    const json = await res.json().catch(() => null)
    return {
      name:        json?.name ?? "Messenger User",
      profile_pic: json?.profile_pic ?? null,
    }
  } catch {
    return { name: "Messenger User", profile_pic: null }
  }
}
