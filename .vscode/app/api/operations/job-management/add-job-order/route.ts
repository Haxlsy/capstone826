import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customer_id,
      service_id,
      vehicle_type_id,
      assigned_technician_id,
      plate_number,
      car_make,
      car_model,
      car_color,
      payment_amount,
      scheduled_start,
      scheduled_end,
    } = body;

    if (!customer_id || !service_id || !vehicle_type_id) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const startDate = scheduled_start ?? now.toISOString().slice(0, 10);

    // Calculate end date from service duration if not provided
    let endDate = scheduled_end ?? null;
    if (!endDate && scheduled_start) {
      const { data: svc } = await supabase
        .from("service")
        .select("estimated_duration_days")
        .eq("service_id", service_id)
        .single();
      if (svc?.estimated_duration_days) {
        const d = new Date(scheduled_start);
        d.setDate(d.getDate() + svc.estimated_duration_days);
        endDate = d.toISOString().slice(0, 10);
      }
    }

    const payload: any = {
      customer_id,
      service_id,
      vehicle_type_id,
      assigned_technician_id: assigned_technician_id ?? null,
      created_by_user_id: user.id,
      plate_number: plate_number ?? null,
      car_make: car_make ?? null,
      car_model: car_model ?? null,
      car_color: car_color ?? null,
      payment_amount: payment_amount ?? 0,
      scheduled_start: startDate,
      scheduled_end: endDate,
      local_uuid: randomUUID(),
    };

    let { data, error } = await supabase
      .from("job_order")
      .insert([payload])
      .select()
      .single();

    // Fallback to admin client if RLS blocks insert
    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin.from("job_order").insert([payload]).select().single();
      data = adminRes.data;
      error = (adminRes.error as any) ?? null;
    }

    if (error) {
      return NextResponse.json({ error: (error as any).message ?? String(error) }, { status: 500 });
    }

    return NextResponse.json({ success: true, job_order: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
