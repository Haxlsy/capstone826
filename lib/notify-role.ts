import type { createAdminClient } from "@/lib/supabase/admin"

/**
 * Fans a notification out to every active user with the given role — "look
 * up active users with this role, insert one notification row each," the
 * exact pattern independently duplicated at every Sales escalation site in
 * app/api/webhook/facebook/route.ts before this existed. Best-effort: never
 * throws, so a notification failure can never break the caller's main
 * action (matches how those call sites already wrapped themselves).
 */
export async function notifyRole(
  admin: ReturnType<typeof createAdminClient>,
  role: string,
  input: { type: string; message: string; job_order_id?: string | null; stage_id?: string | null; inquiry_id?: string | null; concern_id?: string | null },
  opts: { excludeUserId?: string | null } = {},
): Promise<void> {
  try {
    const { data: users } = await admin
      .from("user_account")
      .select("id")
      .eq("role", role)
      .eq("is_archived", false)

    const recipients = (users ?? []).filter((u) => u.id !== opts.excludeUserId)
    if (!recipients.length) return

    await admin.from("notification").insert(
      recipients.map((u) => ({
        user_id:      u.id,
        type:         input.type,
        message:      input.message,
        job_order_id: input.job_order_id ?? null,
        stage_id:     input.stage_id ?? null,
        inquiry_id:   input.inquiry_id ?? null,
        concern_id:   input.concern_id ?? null,
        is_read:      false,
      })),
    )
  } catch (err) {
    console.error(`[notify-role] fan-out to role="${role}" failed:`, err)
  }
}
