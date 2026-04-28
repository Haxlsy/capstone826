import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit"
import { addWorkingMins } from "@/lib/time-utils"

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

    // Two-step approach: avoid nested FK embedding which silently fails in PostgREST
    const { data: stages, error: stagesError } = await supabase
      .from("job_stage_progress")
      .select(
        `id, status, rework_instructions, handoff_notes, completion_notes, completed_at,
         messenger_sent, messenger_sent_at,
         custom_name, custom_sequence_order, stage_duration_mins,
         service_stage_id,
         media:stage_media(id, file_url, media_type)`
      )
      .eq("job_order_id", id)
      .order("custom_sequence_order")

    if (stagesError) {
      console.error("[job-orders detail] stages query failed:", stagesError.message)
      return NextResponse.json({ error: `Stages query failed: ${stagesError.message}` }, { status: 500 })
    }

    // Fetch service_stage info separately
    const ssIds = [...new Set((stages ?? []).map((s: any) => s.service_stage_id as string).filter(Boolean))]
    type SSRow = { id: string; name: string; sequence_order: number; category_id: string | null; stage_duration_mins: number }
    let ssRows: SSRow[] = []
    if (ssIds.length > 0) {
      const { data } = await supabase
        .from("service_stage")
        .select("id, name, sequence_order, category_id, stage_duration_mins")
        .in("id", ssIds)
      ssRows = (data ?? []) as SSRow[]
    }
    const ssMap = new Map(ssRows.map((r) => [r.id, r]))

    // Fetch workflow_category info separately
    const catIds = [...new Set(ssRows.map((r) => r.category_id).filter(Boolean) as string[])]
    type CatRow = { id: string; name: string; display_color: string; technician_role: string }
    let catRows: CatRow[] = []
    if (catIds.length > 0) {
      const { data } = await supabase
        .from("workflow_category")
        .select("id, name, display_color, technician_role")
        .in("id", catIds)
      catRows = (data ?? []) as CatRow[]
    }
    const catMap = new Map(catRows.map((r) => [r.id, r]))

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
        stages: (() => {
          // Build mapped stages first
          const mapped = (stages ?? []).map((s: any) => {
            const ss  = s.service_stage_id ? ssMap.get(s.service_stage_id) : null
            const cat = ss?.category_id ? catMap.get(ss.category_id) : null
            return {
              id:                   s.id,
              service_stage_id:     s.service_stage_id ?? null,
              name:                 s.custom_name ?? ss?.name ?? "—",
              sequence_order:       s.custom_sequence_order ?? ss?.sequence_order ?? 0,
              category_id:          cat?.id          ?? null,
              category_name:        cat?.name        ?? null,
              category_color:       cat?.display_color ?? null,
              status:               s.status,
              rework_instructions:  s.rework_instructions,
              handoff_notes:        s.handoff_notes,
              completion_notes:     s.completion_notes ?? null,
              completed_at:         s.completed_at,
              messenger_sent:       s.messenger_sent ?? null,
              messenger_sent_at:    s.messenger_sent_at ?? null,
              media:                s.media ?? [],
              is_delayed:           false,
              expected_end_at:      null as string | null,
              _raw_duration_mins:   (s.stage_duration_mins as number | null) ?? null,
            }
          })

          // Compute delay: sort by sequence_order, accumulate durations using working hours
          if (j.actual_start_at) {
            const sorted = [...mapped].sort((a, b) => a.sequence_order - b.sequence_order)
            const nowMs = Date.now()
            let cumulativeMins = 0
            const jobStart = new Date(j.actual_start_at)
            for (const stage of sorted) {
              // Prefer per-job override duration stored on job_stage_progress, fall back to service_stage
              const overrideDuration = (stage as any)._raw_duration_mins as number | null
              const serviceDuration  = stage.service_stage_id
                ? (ssMap.get(stage.service_stage_id)?.stage_duration_mins ?? 0)
                : 0
              const durationMins = overrideDuration != null ? overrideDuration : serviceDuration
              cumulativeMins += durationMins
              if (durationMins > 0) {
                const expectedEnd = addWorkingMins(jobStart, cumulativeMins)
                stage.expected_end_at = expectedEnd.toISOString()
                stage.is_delayed = stage.status !== "done" && nowMs > expectedEnd.getTime()
              }
            }
          }

          // Strip internal fields before returning
          return mapped.map(({ service_stage_id: _ss, _raw_duration_mins: _rd, ...rest }) => rest)
        })(),
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
      const [{ data: profile }] = await Promise.all([
        admin.from("user_account").select("full_name, role").eq("id", user.id).single(),
        admin.from("job_order_history").insert({
          job_order_id:  id,
          status:        newStatus,
          changed_by_id: user.id,
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        }),
      ])

      if (profile) {
        const isApproval = ["Completed", "Released", "Approved"].includes(newStatus)
        logAudit({
          user_id:   user.id,
          user_name: profile.full_name,
          role:      profile.role,
          category:  isApproval ? "approve" : "update",
          action:    `Updated job status to ${newStatus}`,
          target:    id,
        })
      }
    } else if (head_detailer_id !== undefined || head_installer_id !== undefined || scheduled_at !== undefined) {
      const { data: profile } = await admin.from("user_account").select("full_name, role").eq("id", user.id).single()
      if (profile) {
        logAudit({
          user_id:   user.id,
          user_name: profile.full_name,
          role:      profile.role,
          category:  "update",
          action:    "Updated job assignment",
          target:    id,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
