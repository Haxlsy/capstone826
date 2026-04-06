import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("job_order")
      .select(
        `job_order_id,
         plate_number,
         car_make,
         car_model,
         payment_amount,
         current_status,
         scheduled_start,
         scheduled_end,
         created_at,
         customer:customer_id(full_name, customer_id),
         service:service_id(service_name, service_id),
         vehicle_type:vehicle_type_id(type_name, vehicle_type_id),
         assigned_technician:assigned_technician_id(full_name, user_id)`
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ job_orders: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
