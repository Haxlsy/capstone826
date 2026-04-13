import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("job_order")
      .select(
        `id, status, scheduled_at, actual_start_at, expected_completion_at, created_at,
         customer:customer_record_id(full_name, plate_number, vehicle_unit, contact_number),
         service:service_id(name),
         customer_name, plate_number, vehicle_unit, contact_number`
      )
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data ?? []).map((j: any) => ({
      id:               j.id,
      customer_name:    j.customer?.full_name ?? j.customer_name ?? "—",
      plate_number:     j.customer?.plate_number ?? j.plate_number ?? "—",
      vehicle_unit:     j.customer?.vehicle_unit ?? j.vehicle_unit ?? "—",
      contact_number:   j.customer?.contact_number ?? j.contact_number ?? "—",
      service:          j.service?.name ?? "—",
      status:           j.status,
      scheduled_at:     j.scheduled_at,
      actual_start_at:  j.actual_start_at,
      created_at:       j.created_at,
    }))

    return NextResponse.json({ job_orders: result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
