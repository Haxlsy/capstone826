import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("concern")
      .select(
        `id, title, description, status, response_note,
         submitted_at, resolved_at,
         job:job_order_id(id, status),
         stage:stage_id(id, custom_name, custom_sequence_order,
           service_stage:service_stage_id(name, sequence_order)),
         submitter:submitted_by_id(id, full_name, role),
         resolver:resolved_by_id(full_name),
         media:concern_media(id, file_url, media_type)`
      )
      .order("submitted_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const shaped = (data ?? []).map((c: any) => {
      const stageRow = c.stage as any
      const stageName =
        stageRow?.custom_name ??
        stageRow?.service_stage?.name ??
        null
      const stageOrder =
        stageRow?.custom_sequence_order ??
        stageRow?.service_stage?.sequence_order ??
        null
      return {
        ...c,
        stage_name: stageOrder != null && stageName ? `${stageOrder}. ${stageName}` : stageName,
      }
    })

    return NextResponse.json({ concerns: shaped })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
