import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAuditCall } from "@/hooks/audit-helpers"
import { getRoleCaller } from "@/lib/auth/caller"

function generatePassword(): string {
  // 12 chars from an unambiguous alphabet (no 0/O, 1/l/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  const bytes = randomBytes(12)
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("")
}

export async function POST(request: Request) {
  try {
    const auth = await getRoleCaller(["admin", "super_admin"])
    if ("error" in auth) return auth.error

    const { caller } = auth
    const { userId } = await request.json()

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required." }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch profile for audit log (and the archived check below)
    const { data: profile } = await admin
      .from("user_account")
      .select("full_name, role, is_archived")
      .eq("id", userId)
      .single()

    // An archived account is frozen — the UI already disables Reset Password
    // for it, but this is the authoritative check (e.g. against a direct API call).
    if (profile?.is_archived) {
      return NextResponse.json(
        { error: "This account is archived — restore it first before resetting its password." },
        { status: 409 },
      )
    }

    const newPassword = generatePassword()

    // Update password via Supabase Auth Admin API
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await admin.from("user_account").update({ must_change_password: true }).eq("id", userId)

    // Actor = the admin who performed the reset (previously this was recorded
    // under the reset account itself, so it never showed up under the admin).
    // Logged even if the profile lookup failed — falls back to the user id.
    await logAuditCall(caller, {
      category: "auth",
      action:   "Reset account password",
      target:   profile ? `${profile.full_name} (${profile.role})` : userId,
    })

    return NextResponse.json({ password: newPassword })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
