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

    console.log("[add-job-order] step: fetch service", service_id)
    const { data: svc, error: svcErr } = await admin
      .from("service")
      .select("estimated_duration_mins")
      .eq("id", service_id)
      .single()

    if (svcErr || !svc) {
      console.error("[add-job-order] service fetch error:", svcErr?.message)
      return NextResponse.json({ error: "Service not found." }, { status: 400 })
    }
    console.log("[add-job-order] service ok, duration:", svc.estimated_duration_mins)

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

    // ── Resolve customer record ───────────────────────────────────────────────
    // Always link via customer_record_id. For manual entries, reuse an existing
    // record matched by plate number, or create a new one.
    let resolvedCustomerRecordId: string | null = customer_record_id ?? null

    if (!resolvedCustomerRecordId) {
      // Try to find an existing record by plate number
      if (plate_number?.trim()) {
        const { data: existing } = await admin
          .from("customer_record")
          .select("id")
          .eq("plate_number", plate_number.trim())
          .maybeSingle()

        if (existing) {
          resolvedCustomerRecordId = existing.id
        }
      }

      // No existing record found — create one
      if (!resolvedCustomerRecordId) {
        const { data: newCustomer, error: custErr } = await admin
          .from("customer_record")
          .insert({
            full_name:      customer_name?.trim()    ?? null,
            contact_number: contact_number?.trim()   ?? null,
            plate_number:   plate_number?.trim()     ?? null,
            vehicle_unit:   vehicle_unit?.trim()     ?? null,
          })
          .select("id")
          .single()

        if (custErr) {
          console.error("[add-job-order] customer_record insert error:", custErr.message)
          return NextResponse.json({ error: custErr.message }, { status: 500 })
        }

        resolvedCustomerRecordId = newCustomer.id
      }
    }

    const payload: Record<string, unknown> = {
      service_id,
      scheduled_at:           scheduled_at ?? null,
      expected_completion_at,
      status:                 "Pending",
      customer_record_id:     resolvedCustomerRecordId,
    }

    console.log("[add-job-order] step: insert job_order, payload:", JSON.stringify(payload))
    const { data: job, error: jobErr } = await admin
      .from("job_order")
      .insert(payload)
      .select()
      .single()

    if (jobErr) {
      console.error("[add-job-order] job_order insert error:", jobErr.message, jobErr.details)
      return NextResponse.json({ error: jobErr.message }, { status: 500 })
    }
    console.log("[add-job-order] job_order created:", job.id)

    // job_stage_progress rows are seeded automatically by the
    // on_job_order_created DB trigger — no manual insert needed here.

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
    console.log("[add-job-order] step: insert history")
    const { error: histErr } = await admin.from("job_order_history").insert({
      job_order_id:  job.id,
      status:        "Pending",
      changed_by_id: user.id,
    })
    if (histErr) console.error("[add-job-order] history insert error:", histErr.message)

    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("CRASH IN ADD-JOB-ORDER:", msg)
    console.log("CRASH IN ADD-JOB-ORDER:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
