import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    const { data: job, error } = await admin
      .from("job_order")
      .select(
        `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at,
         customer:customer_record_id(full_name, plate_number, vehicle_unit),
         service:service_id(name),
         customer_name, plate_number, vehicle_unit`
      )
      .eq("id", id)
      .single()

    if (error || !job) return NextResponse.json({ error: "Not found." }, { status: 404 })

    // Team members
    const { data: team } = await admin
      .from("job_order_team")
      .select("role_in_job, user_account:user_account_id(full_name)")
      .eq("job_order_id", id)

    const { data: history } = await admin
      .from("job_order_history")
      .select("status, created_at, changed_by:changed_by_id(full_name)")
      .eq("job_order_id", id)
      .order("created_at", { ascending: true })

    const { data: stages } = await admin
      .from("job_stage_progress")
      .select(
        `id, status, rework_instructions, handoff_notes, completed_at,
         stage:service_stage_id(name, sequence_order, category),
         media:stage_media(id, file_url, media_type)`
      )
      .eq("job_order_id", id)
      .order("service_stage_id")

    const j = job as any
    const headDetailer = (team ?? []).find((t: any) => t.role_in_job === "head_detailer")
    const headInstaller = (team ?? []).find((t: any) => t.role_in_job === "head_installer")

    return NextResponse.json({
      job: {
        id:                      j.id,
        customer_name:           j.customer?.full_name ?? j.customer_name ?? "—",
        plate_number:            j.customer?.plate_number ?? j.plate_number ?? "—",
        vehicle_unit:            j.customer?.vehicle_unit ?? j.vehicle_unit ?? "—",
        service:                 j.service?.name ?? "—",
        head_detailer:           (headDetailer?.user_account as any)?.full_name ?? "—",
        head_installer:          (headInstaller?.user_account as any)?.full_name ?? "—",
        status:                  j.status,
        scheduled_at:            j.scheduled_at,
        actual_start_at:         j.actual_start_at,
        expected_completion_at:  j.expected_completion_at,
        created_at:              j.created_at,
        timeline: (history ?? []).map((h: any) => ({
          status:     h.status,
          created_at: h.created_at,
          changed_by: h.changed_by?.full_name ?? "System",
        })),
        stages: (stages ?? []).map((s: any) => ({
          id:                   s.id,
          name:                 s.stage?.name ?? "—",
          sequence_order:       s.stage?.sequence_order,
          category:             s.stage?.category,
          status:               s.status,
          rework_instructions:  s.rework_instructions,
          handoff_notes:        s.handoff_notes,
          completed_at:         s.completed_at,
          media:                s.media ?? [],
        })),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
