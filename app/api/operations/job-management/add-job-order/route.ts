import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { addWorkingMins } from "@/hooks/time-utils"

interface CustomStage {
  service_stage_id:      string | null   // null for stages added only for this job
  is_new:                boolean
  custom_name:           string
  custom_stage_category: string | null
  custom_sequence_order: number
  stage_duration_mins:   number
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      customer_record_id,
      service_id,
      head_detailer_id,
      head_installer_id,
      detailer_ids,
      installer_ids,
      scheduled_at,
      // Service overrides
      custom_service_name,
      custom_description,
      custom_duration_mins,
      custom_stages,
      // Manual customer fields
      customer_name,
      contact_number,
      email,
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
    const [{ data: svc, error: svcErr }, { data: callerProfile }] = await Promise.all([
      admin.from("service").select("estimated_duration_mins").eq("id", service_id).single(),
      admin.from("user_account").select("full_name, role").eq("id", user.id).single(),
    ])

    if (svcErr || !svc) {
      console.error("[add-job-order] service fetch error:", svcErr?.message)
      return NextResponse.json({ error: "Service not found." }, { status: 400 })
    }

    // Derive duration: sum from stages (most accurate) → explicit override → service default
    const stageDurationSum =
      Array.isArray(custom_stages) && (custom_stages as CustomStage[]).length > 0
        ? (custom_stages as CustomStage[]).reduce((acc, s) => acc + (s.stage_duration_mins ?? 0), 0)
        : null

    const effectiveDurationMins =
      stageDurationSum !== null && stageDurationSum > 0
        ? stageDurationSum
        : typeof custom_duration_mins === "number" && custom_duration_mins > 0
          ? custom_duration_mins
          : svc.estimated_duration_mins

    let expected_completion_at: string | null = null
    if (scheduled_at && effectiveDurationMins) {
      const d = new Date(scheduled_at)
      if (!isNaN(d.getTime())) {
        expected_completion_at = addWorkingMins(d, effectiveDurationMins).toISOString()
      } else {
        console.error("Invalid date received:", scheduled_at)
      }
    }

    // ── Resolve customer record ───────────────────────────────────────────────
    let resolvedCustomerRecordId: string | null = customer_record_id ?? null
    // These mirror the customer's data directly on job_order so queries work
    // without always joining customer_record.
    let resolvedCustomerName:   string | null = null
    let resolvedContactNumber:  string | null = null
    let resolvedPlateNumber:    string | null = null
    let resolvedVehicleUnit:    string | null = null

    if (resolvedCustomerRecordId) {
      // Selected from customer records — fetch the data to denormalise onto job_order.
      const { data: existingCustomer } = await admin
        .from("customer_record")
        .select("full_name, contact_number, plate_number, vehicle_unit")
        .eq("id", resolvedCustomerRecordId)
        .single()

      if (existingCustomer) {
        resolvedCustomerName  = (existingCustomer as any).full_name      ?? null
        resolvedContactNumber = (existingCustomer as any).contact_number ?? null
        resolvedPlateNumber   = (existingCustomer as any).plate_number   ?? null
        resolvedVehicleUnit   = (existingCustomer as any).vehicle_unit   ?? null
      }
    } else {
      // Manual entry — create or reuse a customer_record row.
      if (plate_number?.trim()) {
        const { data: existing } = await admin
          .from("customer_record")
          .select("id")
          .eq("plate_number", plate_number.trim())
          .maybeSingle()

        if (existing) resolvedCustomerRecordId = existing.id
      }

      if (!resolvedCustomerRecordId) {
        const { data: newCustomer, error: custErr } = await admin
          .from("customer_record")
          .insert({
            full_name:      customer_name?.trim()  ?? null,
            contact_number: contact_number?.trim() ?? null,
            email:          email?.trim()          ?? null,
            plate_number:   plate_number?.trim()   ?? null,
            vehicle_unit:   vehicle_unit?.trim()   ?? null,
          })
          .select("id")
          .single()

        if (custErr) {
          console.error("[add-job-order] customer_record insert error:", custErr.message)
          return NextResponse.json({ error: custErr.message }, { status: 500 })
        }

        resolvedCustomerRecordId = newCustomer.id
      }

      resolvedCustomerName  = customer_name?.trim()  ?? null
      resolvedContactNumber = contact_number?.trim() ?? null
      resolvedPlateNumber   = plate_number?.trim()   ?? null
      resolvedVehicleUnit   = vehicle_unit?.trim()   ?? null
    }

    // ── Guard: reject if customer already has an active job ──────────────────
    if (resolvedCustomerRecordId) {
      const ACTIVE_STATUSES = ["Pending", "Ongoing", "For Rework", "Delayed"]
      const { data: existingActiveJob } = await admin
        .from("job_order")
        .select("id")
        .eq("customer_record_id", resolvedCustomerRecordId)
        .in("status", ACTIVE_STATUSES)
        .maybeSingle()

      if (existingActiveJob) {
        return NextResponse.json(
          { error: "This customer already has an active job order. Complete or cancel it before adding a new one." },
          { status: 409 }
        )
      }
    }

    // ── Insert job order ──────────────────────────────────────────────────────
    const jobPayload: Record<string, unknown> = {
      service_id,
      scheduled_at:           scheduled_at ?? null,
      expected_completion_at,
      status:                 "Pending",
      customer_record_id:     resolvedCustomerRecordId,
      // Denormalised customer fields — populated for both record-selected and manual paths
      customer_name:          resolvedCustomerName,
      contact_number:         resolvedContactNumber,
      plate_number:           resolvedPlateNumber,
      vehicle_unit:           resolvedVehicleUnit,
    }

    // Store overrides only when they differ from the original
    if (custom_service_name) jobPayload.custom_service_name = custom_service_name
    if (custom_description)  jobPayload.custom_description  = custom_description
    // Persist the effective duration (from stage sum, explicit override, or service default)
    if (effectiveDurationMins && effectiveDurationMins > 0) {
      jobPayload.custom_duration_mins = effectiveDurationMins
    }

    console.log("[add-job-order] step: insert job_order")
    const { data: job, error: jobErr } = await admin
      .from("job_order")
      .insert(jobPayload)
      .select()
      .single()

    if (jobErr) {
      console.error("[add-job-order] job_order insert error:", jobErr.message, jobErr.details)
      return NextResponse.json({ error: jobErr.message }, { status: 500 })
    }
    console.log("[add-job-order] job_order created:", job.id)

    // ── Apply stage overrides ─────────────────────────────────────────────────
    // The DB trigger (on_job_order_created) seeds job_stage_progress from service_stage.
    // Two cases:
    //   1. Existing stage (is_new=false): UPDATE the seeded row with custom name / order.
    //   2. New stage (is_new=true):       INSERT a new row with no service_stage_id.
    if (Array.isArray(custom_stages) && custom_stages.length > 0) {
      const stages = custom_stages as CustomStage[]

      const existing = stages.filter((s) => !s.is_new && s.service_stage_id)
      const newStages = stages.filter((s) => s.is_new)

      // Update seeded rows
      if (existing.length > 0) {
        await Promise.all(
          existing.map((cs) =>
            admin
              .from("job_stage_progress")
              .update({
                custom_name:           cs.custom_name,
                custom_sequence_order: cs.custom_sequence_order,
                stage_duration_mins:   cs.stage_duration_mins ?? null,
              })
              .eq("job_order_id", job.id)
              .eq("service_stage_id", cs.service_stage_id)
          )
        )
      }

      // Insert custom-only stages
      if (newStages.length > 0) {
        await admin.from("job_stage_progress").insert(
          newStages.map((cs) => ({
            job_order_id:          job.id,
            service_stage_id:      null,
            custom_name:           cs.custom_name,
            custom_stage_category: cs.custom_stage_category,
            custom_sequence_order: cs.custom_sequence_order,
            stage_duration_mins:   cs.stage_duration_mins ?? null,
          }))
        )
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

    // ── Log initial status ────────────────────────────────────────────────────
    console.log("[add-job-order] step: insert history")
    const { error: histErr } = await admin.from("job_order_history").insert({
      job_order_id:  job.id,
      status:        "Pending",
      changed_by_id: user.id,
    })
    if (histErr) console.error("[add-job-order] history insert error:", histErr.message)

    if (callerProfile) {
      logAudit({
        user_id:   user.id,
        user_name: callerProfile.full_name,
        role:      callerProfile.role,
        category:  "create",
        action:    "Created job order",
        target:    resolvedCustomerName ?? job.id,
      })
    }

    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("CRASH IN ADD-JOB-ORDER:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
