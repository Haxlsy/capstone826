import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const { userId, isArchived } = await request.json()

  console.log("[archive-account] Request:", { userId, isArchived })

  if (!userId || typeof isArchived !== "boolean") {
    return NextResponse.json({ error: "userId and isArchived are required." }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("profile")
    .update({ is_archived: isArchived })
    .eq("user_id", userId)

  if (error) {
    console.error("[archive-account] Update failed:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("[archive-account] Done — userId:", userId, "isArchived:", isArchived)
  return NextResponse.json({ success: true })
}
