import { jobCustomer } from "@/lib/operations/job-customer"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAuditCaller, getRoleCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { normalizeName, validateName } from "@/lib/name"
import { manilaToday } from "@/lib/technician-availability"

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function validateWorkHours(start: string, end: string): string | null {
  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
  const MIN = toMins("08:00"), MAX = toMins("20:00")
  if (toMins(start) < MIN || toMins(start) > MAX) return "Start time must be between 8:00 AM and 8:00 PM."
  if (toMins(end)   < MIN || toMins(end)   > MAX) return "End time must be between 8:00 AM and 8:00 PM."
  if (toMins(end) <= toMins(start))               return "End time must be after start time."
  return null
}

// GET — list technicians (detailers/installers) with availability.
// `?status=active` (default) | `archived` | `all` — technicians are archived,
// never deleted, since job_order_team rows reference them.
export async function GET(request: Request) {
  try {
    // Also read by the Admin Dashboard's oversight widget
    // (components/AdminSide/dashboard/TechnicianAvailability.tsx) — a
    // deliberate, narrow read-only exception, not a blanket cross-role grant.
    const auth = await getRoleCaller(["operations", "admin", "super_admin"])
    if ("error" in auth) return auth.error

    const supabase = createAdminClient()
    const status = new URL(request.url).searchParams.get("status") ?? "active"

    let techQuery = supabase
      .from("technician")
      .select("id, full_name, first_name, last_name, role, is_available, is_archived, available_days, work_start_time, work_end_time, availability_override_date")
    if (status === "active")        techQuery = techQuery.eq("is_archived", false)
    else if (status === "archived") techQuery = techQuery.eq("is_archived", true)

    const [{ data, error }, { data: assignments }] = await Promise.all([
      techQuery
        .order("role")
        .order("full_name"),
      supabase
        .from("job_order_team")
        .select("technician_id, job_order_id")
        .not("technician_id", "is", null),
    ])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const assignedJobIds = [...new Set((assignments ?? []).map((a: any) => a.job_order_id as string))]

    let ongoingMap = new Map<string, { job_id: string; customer: string; service: string }>()

    const ACTIVE_STATUSES = ["Pending", "Ongoing", "For Rework", "Delayed"]

    if (assignedJobIds.length > 0) {
      const { data: ongoingJobs } = await supabase
        .from("job_order")
        .select(
          `id, status, customer_name,
           customer:customer_record_id(owner:customer!customer_id(full_name)),
           service:service_id(name)`
        )
        .in("id", assignedJobIds)
        .in("status", ACTIVE_STATUSES)

      const jobInfoMap = new Map<string, { job_id: string; customer: string; service: string }>()
      for (const j of ongoingJobs ?? []) {
        jobInfoMap.set(j.id, {
          job_id:   j.id,
          customer: jobCustomer(j as any).name ?? "—",
          service:  (j.service  as any)?.name ?? "—",
        })
      }

      for (const a of assignments ?? []) {
        const jobInfo = jobInfoMap.get(a.job_order_id)
        if (jobInfo && a.technician_id) {
          ongoingMap.set(a.technician_id, jobInfo)
        }
      }
    }

    const technicians = (data ?? []).map((t: any) => ({
      id:               t.id,
      full_name:        t.full_name,
      first_name:       t.first_name ?? null,
      last_name:        t.last_name ?? null,
      role:             t.role,
      is_available:     t.is_available,
      is_archived:      t.is_archived ?? false,
      available_days:   (t.available_days as string[]) ?? ALL_DAYS,
      work_start_time:  t.work_start_time ?? "08:00:00",
      work_end_time:    t.work_end_time   ?? "20:00:00",
      availability_override_date: t.availability_override_date ?? null,
      active_job:       ongoingMap.get(t.id) ?? null,
    }))

    return NextResponse.json({ technicians })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}

// PATCH — update a technician's details
export async function PATCH(request: Request) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const { id, is_available, first_name, last_name, role, is_archived, available_days, work_start_time, work_end_time } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const updates: any = {}

    // Scopes the toggle to today (Manila) — see lib/technician-availability.ts.
    // Every other day, availability falls back to the weekly schedule, so this
    // override never needs to be manually undone.
    if (typeof is_available === "boolean") {
      updates.is_available = is_available
      updates.availability_override_date = manilaToday().dateKey
    }
    if (typeof is_archived  === "boolean") updates.is_archived  = is_archived
    if (first_name?.trim() || last_name?.trim()) {
      const firstName = normalizeName(first_name)
      const lastName  = normalizeName(last_name)
      const nameError = validateName(firstName, "First name") ?? validateName(lastName, "Last name")
      if (nameError) return NextResponse.json({ error: nameError }, { status: 400 })
      updates.first_name = firstName
      updates.last_name  = lastName
      updates.full_name  = `${firstName} ${lastName}`
    }
    if (role === "detailer" || role === "installer") updates.role = role
    if (Array.isArray(available_days))    updates.available_days = available_days

    if (work_start_time || work_end_time) {
      const start = work_start_time ?? "08:00"
      const end   = work_end_time   ?? "20:00"
      const err   = validateWorkHours(start, end)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
      updates.work_start_time = start
      updates.work_end_time   = end
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields provided for update." }, { status: 400 })
    }

    const { error } = await supabase
      .from("technician")
      .update(updates)
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let techName: string | null = updates.full_name || null
    if (!techName) {
      const { data: techRow } = await supabase
        .from("technician")
        .select("full_name")
        .eq("id", id)
        .single()
      techName = (techRow as any)?.full_name ?? null
    }

    const caller = await getAuditCaller()
    if (caller) {
      logAuditCall(caller, {
        category: "update",
        action:   "Updated technician",
        target:   techName ?? `technician ${id}`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST — create a new technician (detailer or installer)
export async function POST(request: Request) {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const { first_name, last_name, role, available_days, work_start_time, work_end_time } = await request.json()

    const firstName = normalizeName(first_name)
    const lastName  = normalizeName(last_name)
    const nameError = validateName(firstName, "First name") ?? validateName(lastName, "Last name")
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 })
    }
    if (role !== "detailer" && role !== "installer") {
      return NextResponse.json({ error: "role must be 'detailer' or 'installer'." }, { status: 400 })
    }

    const start = work_start_time ?? "08:00"
    const end   = work_end_time   ?? "20:00"
    const hoursErr = validateWorkHours(start, end)
    if (hoursErr) return NextResponse.json({ error: hoursErr }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("technician")
      .insert({
        first_name:       firstName,
        last_name:        lastName,
        full_name:        `${firstName} ${lastName}`,
        role,
        is_available:     true,
        available_days:   Array.isArray(available_days) ? available_days : ALL_DAYS,
        work_start_time:  start,
        work_end_time:    end,
      })
      .select("id, full_name, first_name, last_name, role, is_available, available_days, work_start_time, work_end_time")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const caller = await getAuditCaller()
    if (caller) {
      logAuditCall(caller, {
        category: "create",
        action:   "Created technician",
        target:   data.full_name,
      })
    }

    return NextResponse.json({ technician: data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
