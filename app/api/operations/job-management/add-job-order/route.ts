import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { addWorkingMins } from "@/hooks/time-utils"
import { loadWorkSchedule, loadOperatingHoursSettings } from "@/lib/operating-hours"
import { isWithinOperatingHours, formatOperatingHours } from "@/types/chatbot"
import { normalizePhone } from "@/lib/phone"
import { sendPushToUser } from "@/lib/push/send"
import { getRoleCaller } from "@/lib/auth/caller"
import { decideManualCustomer } from "@/lib/operations/manual-customer"
import { findActiveJobsByCustomerRecord } from "@/lib/sales/customer-record-lock"

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
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const body = await request.json()
    const {
      // Client-generated UUID (offline outbox sync only — see
      // docs/plan/operations-offline-mode-plan.md). Lets a retried sync
      // request — network drops after the server commits but before the
      // client sees the response — be a safe no-op instead of creating a
      // duplicate job order.
      id,
      customer_record_id,
      // Manual entry only: the existing customer the form auto-fetched (name
      // locked, other fields edited) — see lib/operations/manual-customer.ts.
      matched_customer_record_id,
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

    // Server-authoritative — the form validates the same way, but a direct
    // API call must not be able to schedule a job outside the shop's actual
    // open days/hours either.
    if (scheduled_at) {
      const d = new Date(scheduled_at)
      if (!isNaN(d.getTime())) {
        const hours = await loadOperatingHoursSettings(admin)
        const check = isWithinOperatingHours(hours, d)
        if (!check.ok) {
          const reason = check.reason === "closed_day"
            ? `That date is closed. Open days: ${formatOperatingHours(hours)}`
            : `Start time must be within working hours (${formatOperatingHours(hours)})`
          return NextResponse.json({ error: reason }, { status: 400 })
        }
      }
    }

    // Idempotency check — if this exact request already landed (a prior
    // attempt whose response the client never saw), return the existing job
    // instead of re-running creation, team assignment, notifications, and
    // history a second time.
    if (id) {
      const { data: existingJob } = await admin.from("job_order").select().eq("id", id).maybeSingle()
      if (existingJob) {
        return NextResponse.json({ success: true, job: existingJob }, { status: 200 })
      }
    }

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
        const schedule = await loadWorkSchedule(admin)
        expected_completion_at = addWorkingMins(d, effectiveDurationMins, schedule).toISOString()
      } else {
        console.error("Invalid date received:", scheduled_at)
      }
    }

    // ── Resolve customer + vehicle ────────────────────────────────────────────
    // A `customer` is the person (name, phone, email, Messenger account); a
    // `customer_record` is one of their VEHICLES, and job_order points at the
    // vehicle. `customer_record_id` / `matched_customer_record_id` are vehicle ids.
    let resolvedCustomerRecordId: string | null = customer_record_id ?? null
    // These mirror the customer's data directly on job_order so queries work
    // without always joining.
    let resolvedCustomerName:   string | null = null
    let resolvedContactNumber:  string | null = null
    let resolvedPlateNumber:    string | null = null
    let resolvedVehicleUnit:    string | null = null
    // Set when this request also created/edited a customer or vehicle (manual entry).
    let customerAuditAction:    string | null = null

    const like = (v: string) => v.replace(/[\\%_]/g, "\\$&")
    type OneOrMany<T> = T | T[] | null
    const firstOf = <T,>(v: OneOrMany<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

    if (resolvedCustomerRecordId) {
      // Picked from customer records — denormalise the vehicle + owner onto job_order.
      const { data: existingVehicle } = await admin
        .from("customer_record")
        .select("plate_number, vehicle_unit, owner:customer!customer_id(full_name, contact_number)")
        .eq("id", resolvedCustomerRecordId)
        .single()

      if (existingVehicle) {
        const owner = firstOf(existingVehicle.owner as OneOrMany<{ full_name: string | null; contact_number: string | null }>)
        resolvedCustomerName  = owner?.full_name ?? null
        resolvedContactNumber = owner?.contact_number ?? null
        resolvedPlateNumber   = (existingVehicle.plate_number as string | null) ?? null
        resolvedVehicleUnit   = (existingVehicle.vehicle_unit as string | null) ?? null
      }
    } else {
      // Manual entry — create or reuse a customer and vehicle.
      // Canonicalise the phone so customers compare consistently.
      const normContact = normalizePhone(contact_number) || (contact_number?.trim() ?? null)

      // Email is required for a manually entered customer. (Picking an existing
      // record above doesn't need it — older records may not have one.)
      const trimmedEmail = typeof email === "string" ? email.trim() : ""
      if (!trimmedEmail) {
        return NextResponse.json({ error: "Email is required." }, { status: 400 })
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
      }

      const plateTrim = plate_number?.trim() ?? ""
      const matchedId =
        typeof matched_customer_record_id === "string" && matched_customer_record_id.trim()
          ? matched_customer_record_id.trim()
          : null

      if (matchedId) {
        // The form auto-fetched an existing customer; only the name is locked.
        const { data: matchedVehicle } = await admin
          .from("customer_record")
          .select("id, customer_id, booked_by_customer_id")
          .eq("id", matchedId)
          .maybeSingle()
        const { data: matchedCustomer } = matchedVehicle
          ? await admin
              .from("customer")
              .select("id, full_name, contact_number, email")
              .eq("id", matchedVehicle.customer_id)
              .maybeSingle()
          : { data: null }

        const customerPhone = normalizePhone(matchedCustomer?.contact_number as string | null)
        const phoneChanged = normContact ? normalizePhone(normContact) !== customerPhone : false
        const emailChanged = trimmedEmail.toLowerCase() !== ((matchedCustomer?.email as string | null) ?? "").toLowerCase()

        const [{ data: plateRows }, { data: emailRows }, { data: phoneRows }] = await Promise.all([
          plateTrim
            ? admin.from("customer_record").select("id, customer_id, vehicle_unit, plate_number")
                .ilike("plate_number", like(plateTrim)).limit(1)
            : Promise.resolve({ data: [] as never[] }),
          emailChanged
            ? admin.from("customer").select("id").ilike("email", like(trimmedEmail)).limit(1)
            : Promise.resolve({ data: [] as never[] }),
          phoneChanged && normContact
            ? admin.from("customer").select("id").eq("contact_number", normContact).limit(1)
            : Promise.resolve({ data: [] as never[] }),
        ])

        const decision = decideManualCustomer({
          customer: (matchedCustomer as never) ?? null,
          matchedVehicle: (matchedVehicle as never) ?? null,
          entry: { phone: contact_number, email: trimmedEmail, plate: plate_number, vehicle: vehicle_unit },
          plateOwner: (plateRows?.[0] as never) ?? null,
          emailOwner: (emailRows?.[0] as never) ?? null,
          phoneOwner: (phoneRows?.[0] as never) ?? null,
        })

        if (decision.kind === "error") {
          return NextResponse.json({ error: decision.message }, { status: decision.status })
        }

        // A vehicle already in service can't have its details changed under the
        // job — check BEFORE any write.
        if (decision.vehicle.mode === "reuse") {
          const locked = await findActiveJobsByCustomerRecord(admin, [decision.vehicle.id])
          if (locked.get(decision.vehicle.id)) {
            return NextResponse.json(
              { error: "This customer already has an active job order. Complete or cancel it before adding a new one." },
              { status: 409 },
            )
          }
        }

        if (Object.keys(decision.customerUpdates).length > 0) {
          const { error: custUpdErr } = await admin
            .from("customer")
            .update({ ...decision.customerUpdates, updated_at: new Date().toISOString() })
            .eq("id", (matchedCustomer as { id: string }).id)
          if (custUpdErr) return NextResponse.json({ error: custUpdErr.message }, { status: 500 })
          customerAuditAction = "Updated customer (via Add Job Order)"
        }

        if (decision.vehicle.mode === "create") {
          const { data: createdVehicle, error: createErr } = await admin
            .from("customer_record")
            .insert(decision.vehicle.insert)
            .select("id")
            .single()
          if (createErr) {
            if (createErr.code === "23505") {
              return NextResponse.json(
                { error: "That plate number is already on file for another customer record." },
                { status: 409 },
              )
            }
            return NextResponse.json({ error: createErr.message }, { status: 500 })
          }
          resolvedCustomerRecordId = createdVehicle.id
          customerAuditAction = "Created vehicle (via Add Job Order)"
        } else {
          resolvedCustomerRecordId = decision.vehicle.id
          if (Object.keys(decision.vehicle.updates).length > 0) {
            const { error: updErr } = await admin
              .from("customer_record")
              .update(decision.vehicle.updates)
              .eq("id", decision.vehicle.id)
            if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
            customerAuditAction = customerAuditAction ?? "Updated vehicle (via Add Job Order)"
          }
        }

        resolvedCustomerName  = decision.snapshot.name
        resolvedContactNumber = decision.snapshot.contact_number
        resolvedPlateNumber   = decision.snapshot.plate_number
        resolvedVehicleUnit   = decision.snapshot.vehicle_unit
      } else {
        // No auto-fetched customer (a direct API call, or a brand-new customer).
        let customerId: string | null = null
        let customerName: string | null = customer_name?.trim() ?? null
        let customerContact: string | null = normContact

        if (plateTrim) {
          const { data: existing } = await admin
            .from("customer_record")
            .select("id, customer_id")
            .eq("plate_number", plateTrim)
            .maybeSingle()
          if (existing) {
            resolvedCustomerRecordId = existing.id
            customerId = existing.customer_id
          }
        }

        // No vehicle by that plate — a customer already known by phone (e.g. one
        // linked to Messenger from an earlier Sales inquiry, with no vehicle yet)
        // is reused rather than duplicated; the vehicle is added to them.
        if (!resolvedCustomerRecordId && normContact) {
          const { data: byPhone } = await admin
            .from("customer")
            .select("id, full_name, contact_number")
            .eq("contact_number", normContact)
            .limit(1)
          if (byPhone && byPhone.length > 0) {
            customerId = byPhone[0].id
            customerName = byPhone[0].full_name
            customerContact = byPhone[0].contact_number
          }
        }

        // An email belongs to one customer: on a DIFFERENT customer than the one
        // resolved (or on any customer when nothing resolved) means a direct API
        // call or a race — reject rather than attach it to the wrong person or
        // create a duplicate.
        const { data: byEmail } = await admin
          .from("customer")
          .select("id")
          .ilike("email", like(trimmedEmail))
          .limit(1)
        if (byEmail && byEmail.length > 0 && byEmail[0].id !== customerId) {
          return NextResponse.json(
            { error: "This email is already registered to another customer." },
            { status: 409 },
          )
        }

        if (!resolvedCustomerRecordId) {
          if (!customerId) {
            const { data: newCustomer, error: custErr } = await admin
              .from("customer")
              .insert({ full_name: customerName, contact_number: normContact, email: trimmedEmail })
              .select("id")
              .single()
            if (custErr) {
              console.error("[add-job-order] customer insert error:", custErr.message)
              return NextResponse.json({ error: custErr.message }, { status: 500 })
            }
            customerId = newCustomer.id
            customerAuditAction = "Created customer (via Add Job Order)"
          }

          const { data: newVehicle, error: vehErr } = await admin
            .from("customer_record")
            .insert({
              customer_id:  customerId,
              plate_number: plateTrim || null,
              vehicle_unit: vehicle_unit?.trim() ?? null,
            })
            .select("id")
            .single()
          if (vehErr) {
            console.error("[add-job-order] vehicle insert error:", vehErr.message)
            // A plate already on file (the lookup above didn't catch it — a
            // formatting/case difference, or a race with another submission)
            // hits the column's UNIQUE constraint here.
            if (vehErr.code === "23505") {
              return NextResponse.json(
                { error: "That plate number is already on file for another customer record." },
                { status: 409 },
              )
            }
            return NextResponse.json({ error: vehErr.message }, { status: 500 })
          }
          resolvedCustomerRecordId = newVehicle.id
        }

        resolvedCustomerName  = customerName
        resolvedContactNumber = customerContact
        resolvedPlateNumber   = plateTrim || null
        resolvedVehicleUnit   = vehicle_unit?.trim() ?? null
      }
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
      ...(id ? { id } : {}), // explicit id overrides the column's gen_random_uuid() default
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

    // ── Notify newly assigned head technicians ────────────────────────────────
    // Only head_detailer_id/head_installer_id map to real login accounts
    // (user_account); plain detailer_ids/installer_ids reference `technician`
    // rows, which have no account and can't receive notifications.
    try {
      const jobLabel = job.job_order_code ?? job.id
      const headNotifs: Record<string, unknown>[] = []
      if (head_detailer_id) {
        headNotifs.push({
          user_id: head_detailer_id,
          type: "job_assigned",
          message: `You've been assigned as Head Detailer for job ${jobLabel}.`,
          job_order_id: job.id,
        })
      }
      if (head_installer_id) {
        headNotifs.push({
          user_id: head_installer_id,
          type: "job_assigned",
          message: `You've been assigned as Head Installer for job ${jobLabel}.`,
          job_order_id: job.id,
        })
      }
      if (headNotifs.length > 0) {
        await admin.from("notification").insert(headNotifs)
        await Promise.all(
          headNotifs.map((n) =>
            sendPushToUser(n.user_id as string, {
              title: "New job assigned",
              body: n.message as string,
              url: `/head-technician/${job.id}`,
            })
          )
        )
      }
    } catch (notifErr) {
      console.error("[add-job-order] notification fan-out failed:", notifErr)
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
      if (customerAuditAction) {
        logAudit({
          user_id:   user.id,
          user_name: callerProfile.full_name,
          role:      callerProfile.role,
          category:  customerAuditAction.startsWith("Created") ? "create" : "update",
          action:    customerAuditAction,
          target:    resolvedCustomerName ?? String(resolvedCustomerRecordId),
        })
      }
    }

    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("CRASH IN ADD-JOB-ORDER:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
