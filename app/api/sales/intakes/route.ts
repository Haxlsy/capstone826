import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const INTAKE_SELECT = `
  intake_id,
  plate_number,
  make,
  model,
  color,
  downpayment,
  balance,
  payment_method,
  scheduled_date,
  status,
  created_at,
  customer:customer_id(full_name,customer_id,contact_number,email,home_address),
  service:service_id(service_name,service_id,estimated_duration_days)
`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customer_id,
      plate_number,
      make,
      model,
      color,
      service_id,
      service_name,
      downpayment,
      balance,
      payment_method,
      scheduled_date,
      status,
    } = body;

    if (!customer_id) {
      return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let resolvedServiceId = service_id ?? null;
    if (!resolvedServiceId && service_name) {
      const svc = await supabase.from("service").select("service_id").eq("service_name", service_name).maybeSingle();
      if (svc.error) return NextResponse.json({ error: svc.error.message }, { status: 500 });
      if (svc.data) resolvedServiceId = svc.data.service_id;
    }

    const payload = {
      customer_id,
      plate_number,
      make,
      model,
      color,
      service_id: resolvedServiceId,
      downpayment: downpayment ?? 0,
      balance: balance ?? 0,
      payment_method,
      scheduled_date: scheduled_date ?? null,
      status: status ?? "pending",
    };

    let { data, error } = await supabase
      .from("customer_intake")
      .insert(payload)
      .select()
      .single();

    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const adminRes = await admin.from("customer_intake").insert(payload).select().single();
        data = adminRes.data;
        error = adminRes.error ?? null;
      } catch (e) {
        // fall through
      }
    }

    if (error) return NextResponse.json({ error: error.message ?? String(error) }, { status: 500 });

    return NextResponse.json({ intake: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let { data, error } = await supabase
      .from("customer_intake")
      .select(INTAKE_SELECT)
      .order("created_at", { ascending: false });

    // Fallback to admin client if RLS blocks the read
    if ((error || !data) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin
        .from("customer_intake")
        .select(INTAKE_SELECT)
        .order("created_at", { ascending: false });
      data = adminRes.data;
      error = adminRes.error ?? null;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ intakes: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
