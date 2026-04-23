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

    const supabase = createAdminClient()

    const { data: job, error } = await supabase
      .from("job_order")
      .select(
        `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at, finishing_approved_at,
         customer:customer_record_id(full_name, plate_number, vehicle_unit, contact_number),
         service:service_id(name),
         customer_name, contact_number, plate_number, vehicle_unit`
      )
      .eq("id", id)
      .single()

    if (error || !job) {
      console.error("[job-orders detail] query failed — id:", id, "error:", error?.message, "code:", error?.code)
      return NextResponse.json({ error: error?.message ?? "Not found." }, { status: 404 })
    }

    // Team members
    const { data: team } = await supabase
      .from("job_order_team")
      .select("role_in_job, user_account:user_account_id(id, full_name), technician:technician_id(id, full_name)")
      .eq("job_order_id", id)

    const { data: history } = await supabase
      .from("job_order_history")
      .select("status, created_at, changed_by:changed_by_id(full_name)")
      .eq("job_order_id", id)
      .order("created_at", { ascending: true })

    const { data: stages } = await supabase
      .from("job_stage_progress")
      .select(
        `id, status, rework_instructions, handoff_notes, completed_at,
         stage:service_stage_id(name, sequence_order, category),
         media:stage_media(id, file_url, media_type)`
      )
      .eq("job_order_id", id)
      .order("service_stage_id")

    const j = job as any
    const headDetailer  = (team ?? []).find((t: any) => t.role_in_job === "head_detailer")
    const headInstaller = (team ?? []).find((t: any) => t.role_in_job === "head_installer")
    const detailers     = (team ?? [])
      .filter((t: any) => t.role_in_job === "detailer")
      .map((t: any) => ({ id: (t.technician as any)?.id ?? "", name: (t.technician as any)?.full_name ?? "Unknown" }))
    const installers    = (team ?? [])
      .filter((t: any) => t.role_in_job === "installer")
      .map((t: any) => ({ id: (t.technician as any)?.id ?? "", name: (t.technician as any)?.full_name ?? "Unknown" }))

    return NextResponse.json({
      job: {
        id:                      j.id,
        customer_name:           j.customer?.full_name ?? j.customer_name ?? "—",
        plate_number:            j.customer?.plate_number ?? j.plate_number ?? "—",
        vehicle_unit:            j.customer?.vehicle_unit ?? j.vehicle_unit ?? "—",
        contact_number:          j.customer?.contact_number ?? j.contact_number ?? "—",
        service:                 j.service?.name ?? "—",
        head_detailer:           (headDetailer?.user_account as any) ?? null,
        head_installer:          (headInstaller?.user_account as any) ?? null,
        detailers,
        installers,
        status:                  j.status,
        scheduled_at:            j.scheduled_at,
        actual_start_at:         j.actual_start_at,
        expected_completion_at:  j.expected_completion_at,
        created_at:              j.created_at,
        finishing_approved_at:   j.finishing_approved_at,
        history: (history ?? []).map((h: any) => ({
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
          messenger_sent:       (s as any).messenger_sent ?? null,
          messenger_sent_at:    (s as any).messenger_sent_at ?? null,
          media:                s.media ?? [],
        })),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const body = await request.json()
    const {
      status,
      reason,
      head_detailer_id,
      head_installer_id,
      scheduled_at,
    } = body

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // Fetch current job to detect status change
    const { data: current } = await admin
      .from("job_order")
      .select("status, actual_start_at")
      .eq("id", id)
      .single()

    const updates: Record<string, any> = {}
    if (status !== undefined)      updates.status      = status
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at
    // Set actual_start_at when first moved to Ongoing
    if (status === "Ongoing" && !current?.actual_start_at) {
      updates.actual_start_at = new Date().toISOString()
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await admin
        .from("job_order")
        .update(updates)
        .eq("id", id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update team assignments (upsert by role)
    if (head_detailer_id !== undefined) {
      await admin.from("job_order_team").delete().eq("job_order_id", id).eq("role_in_job", "head_detailer")
      if (head_detailer_id) {
        await admin.from("job_order_team").insert({
          job_order_id:    id,
          user_account_id: head_detailer_id,
          role_in_job:     "head_detailer",
        })
      }
    }
    if (head_installer_id !== undefined) {
      await admin.from("job_order_team").delete().eq("job_order_id", id).eq("role_in_job", "head_installer")
      if (head_installer_id) {
        await admin.from("job_order_team").insert({
          job_order_id:    id,
          user_account_id: head_installer_id,
          role_in_job:     "head_installer",
        })
      }
    }

    // Log status change
    const newStatus = updates.status
    if (newStatus && current?.status !== newStatus) {
      await admin.from("job_order_history").insert({
        job_order_id:  id,
        status:        newStatus,
        changed_by_id: user.id,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
