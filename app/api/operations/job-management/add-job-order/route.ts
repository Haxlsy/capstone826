import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      customer_record_id,  // optional — from Messenger booking
      service_id,
      head_detailer_id,    // user_account.id of head detailer
      head_installer_id,   // user_account.id of head installer
      detailer_ids,        // technician.id[] — detailer team members
      installer_ids,       // technician.id[] — installer team members
      scheduled_at,
      // Manual fields (when no Messenger booking)
      customer_name,
      contact_number,
      plate_number,
      vehicle_unit,
    } = body

    if (!service_id) {
      return NextResponse.json({ error: "service_id is required." }, { status: 400 })
    }
    if (!customer_record_id && !customer_name) {
      return NextResponse.json(
        { error: "Either customer_record_id or manual customer details are required." },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

    const admin = createAdminClient()

    // Fetch service stages and duration in one query
    const { data: svc, error: svcErr } = await admin
      .from("service")
      .select("estimated_duration_mins, stages:service_stage(id)")
      .eq("id", service_id)
      .single()

    if (svcErr || !svc) {
      return NextResponse.json({ error: "Service not found." }, { status: 400 })
    }

    let expected_completion_at: string | null = null
    if (scheduled_at && svc.estimated_duration_mins) {
      const d = new Date(scheduled_at)
      // Check if the date is actually valid
      if (!isNaN(d.getTime())) {
        d.setMinutes(d.getMinutes() + svc.estimated_duration_mins);
        expected_completion_at = d.toISOString();
      } else {
        // If date is invalid, just use null or a safe default
        console.error("Invalid date received:", scheduled_at);
      }
    }

    const payload: Record<string, unknown> = {
      service_id,
      scheduled_at:           scheduled_at ?? null,
      expected_completion_at,
      status:                 "Pending",
    }

    if (customer_record_id) {
      payload.customer_record_id = customer_record_id
    } else {
      payload.customer_name   = customer_name?.trim() ?? null
      payload.contact_number  = contact_number?.trim() ?? null
      payload.plate_number    = plate_number?.trim() ?? null
      payload.vehicle_unit    = vehicle_unit?.trim() ?? null
    }

    const { data: job, error: jobErr } = await admin
      .from("job_order")
      .insert(payload)
      .select()
      .single()

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

    // ── Seed job_stage_progress rows (one per service stage) ─────────────────
    const stages = (svc.stages as { id: string }[]) ?? []
    if (stages.length > 0) {
      const progressRows = stages.map((s) => ({
        job_order_id:     job.id,
        service_stage_id: s.id,
        status:           "pending" as const,
      }))
      const { error: stageErr } = await admin.from("job_stage_progress").insert(progressRows)
      if (stageErr) {
        // Rollback job order if stages can't be seeded
        await admin.from("job_order").delete().eq("id", job.id)
        return NextResponse.json({ error: `Failed to seed stages: ${stageErr.message}` }, { status: 500 })
      }
    }

    // ── Assign team members ───────────────────────────────────────────────────
    const teamInserts: Record<string, unknown>[] = []
    if (head_detailer_id) {
      teamInserts.push({ job_order_id: job.id, user_account_id: head_detailer_id, role_in_job: "head_detailer" })
    }
    if (head_installer_id) {
      teamInserts.push({ job_order_id: job.id, user_account_id: head_installer_id, role_in_job: "head_installer" })
    }
    for (const did of detailer_ids ?? []) {
      teamInserts.push({ job_order_id: job.id, technician_id: did, role_in_job: "detailer" })
    }
    for (const iid of installer_ids ?? []) {
      teamInserts.push({ job_order_id: job.id, technician_id: iid, role_in_job: "installer" })
    }
    if (teamInserts.length > 0) {
      await admin.from("job_order_team").insert(teamInserts)
    }

    // ── Log initial status to history ─────────────────────────────────────────
    await admin.from("job_order_history").insert({
      job_order_id:  job.id,
      status:        "Pending",
      changed_by_id: user.id,
    })

    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("CRASH IN ADD-JOB-ORDER:", msg)
    console.log("CRASH IN ADD-JOB-ORDER:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
