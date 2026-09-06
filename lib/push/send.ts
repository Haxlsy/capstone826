import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"

let configured = false

function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

/**
 * Fans a push notification out to every device a user has subscribed
 * (phone on the home screen, desktop browser, etc). Best-effort: a failed
 * or expired subscription is pruned and never bubbles up to the caller —
 * this always runs alongside the existing `notification` table insert,
 * never in place of it.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  ensureConfigured()
  if (!configured) return

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from("push_subscription")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)

  if (!subs || subs.length === 0) return

  const message = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message
        )
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscription").delete().eq("id", sub.id)
        } else {
          console.error("[push] send failed for subscription", sub.id, err)
        }
      }
    })
  )
}
