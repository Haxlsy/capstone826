import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("job_stage_progress")
      .select(
        `id, job_order_id, status, rework_instructions, handoff_notes, completed_at,
         stage:service_stage_id(id, name, category, sequence_order),
         completed_by:completed_by_id(full_name),
         media:stage_media(id, file_url, media_type, uploaded_at)`
      )
      .eq("id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Not found." }, { status: 404 })
    }

    return NextResponse.json({ stage: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
