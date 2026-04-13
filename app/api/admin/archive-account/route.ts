import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const { userId, isArchived } = await request.json()

  if (!userId || typeof isArchived !== "boolean") {
    return NextResponse.json({ error: "userId and isArchived (boolean) are required." }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("user_account")
    .update({ is_archived: isArchived })
    .eq("id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
