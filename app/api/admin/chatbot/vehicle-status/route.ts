import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const plate = searchParams.get("plate")?.trim()

  if (!plate) {
    return NextResponse.json({ error: "plate is required." }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const ACTIVE_STATUSES = ["Pending", "Ongoing", "For Rework", "Delayed"]

    // Join via customer_record to filter by plate number
    const { data, error } = await supabase
      .from("job_order")
      .select(
        `id, status, scheduled_date,
         service:service_id(name),
         customer_record:customer_record_id(full_name, plate_number)`
      )
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Filter client-side since Supabase join filters on referenced table columns
    // require a slightly different query pattern
    const match = (data ?? []).find(
      (j: any) =>
        (j.customer_record as any)?.plate_number?.toLowerCase() === plate.toLowerCase()
    )

    if (!match) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({
      found:          true,
      status:         match.status,
      service:        (match.service as any)?.name ?? "—",
      customer_name:  (match.customer_record as any)?.full_name ?? "—",
      scheduled_date: match.scheduled_date ?? null,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
