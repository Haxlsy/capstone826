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
      head_detailer_id,    // user_account.id of head detailer (optional)
      head_installer_id,   // user_account.id of head installer (optional)
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

    // Calculate expected_completion_at from service duration
    let expected_completion_at: string | null = null
    if (scheduled_at) {
      const { data: svc } = await admin
        .from("service")
        .select("estimated_duration_mins")
        .eq("id", service_id)
        .single()
      if (svc?.estimated_duration_mins) {
        const d = new Date(scheduled_at)
        d.setMinutes(d.getMinutes() + svc.estimated_duration_mins)
        expected_completion_at = d.toISOString()
      }
    }

    const payload: Record<string, any> = {
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

    const { data, error } = await admin
      .from("job_order")
      .insert(payload)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Assign head detailer / head installer to the team table
    const teamInserts: Record<string, any>[] = []
    if (head_detailer_id) {
      teamInserts.push({
        job_order_id:    data.id,
        user_account_id: head_detailer_id,
        role_in_job:     "head_detailer",
      })
    }
    if (head_installer_id) {
      teamInserts.push({
        job_order_id:    data.id,
        user_account_id: head_installer_id,
        role_in_job:     "head_installer",
      })
    }
    if (teamInserts.length > 0) {
      await admin.from("job_order_team").insert(teamInserts)
    }

    // Log initial status to history
    await admin.from("job_order_history").insert({
      job_order_id: data.id,
      status:       "Pending",
      changed_by_id: user.id,
    })

    return NextResponse.json({ success: true, job: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
