import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit-helpers"

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
    const { userId } = await request.json()

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required." }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch profile for audit log
    const { data: profile } = await admin
      .from("user_account")
      .select("full_name, role")
      .eq("id", userId)
      .single()

    const newPassword = generatePassword()

    // Update password via Supabase Auth Admin API
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (profile) {
      logAudit({
        user_id:   userId,
        user_name: profile.full_name,
        role:      profile.role,
        category:  "auth",
        action:    "Password reset",
        target:    profile.full_name,
      })
    }

    return NextResponse.json({ password: newPassword })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
