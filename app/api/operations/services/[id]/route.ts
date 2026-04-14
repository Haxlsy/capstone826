import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// PATCH /api/operations/services/[id]
// Body: { is_archived: boolean }  — toggles archive status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (typeof body.is_archived !== "boolean") {
      return NextResponse.json({ error: "is_archived (boolean) is required." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("service")
      .update({ is_archived: body.is_archived })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
