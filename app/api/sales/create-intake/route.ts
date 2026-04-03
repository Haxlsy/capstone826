import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const INTAKE_SELECT = `
  intake_id, plate_number, make, model, color,
  downpayment, balance, payment_method, scheduled_date, status, created_at,
  vehicle_type_id,
  customer:customer_id(full_name, customer_id, contact_number, email, home_address),
  service:service_id(service_name, service_id, estimated_duration_days),
  vehicle_type:vehicle_type_id(vehicle_type_id, type_name)
`;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      customer_id,
      full_name,
      contact_number,
      email,
      home_address,
      plate_number,
      make,
      model,
      color,
      service_id,
      service_name,
      vehicle_type_id,
      downpayment,
      balance,
      payment_method,
      scheduled_date,
      status,
    } = body;

    const admin = getAdmin()

    let custId = customer_id ?? null;
    let customerRow: any = null;

    // Create customer if no customer_id provided
    if (!custId) {
      const insertRes = await admin
        .from("customer")
        .insert({ full_name, contact_number, email, home_address })
        .select()
        .single();

      if (insertRes.error) {
        return NextResponse.json({ error: insertRes.error.message ?? String(insertRes.error) }, { status: 500 });
      }

      customerRow = insertRes.data;
      custId = customerRow.customer_id ?? customerRow.id;
    }

    if (!custId) return NextResponse.json({ error: "Unable to determine customer id." }, { status: 400 });

    // Resolve service id by name if provided
    let resolvedServiceId = service_id ?? null;
    if (!resolvedServiceId && service_name) {
      const svc = await admin.from("service").select("service_id").eq("service_name", service_name).maybeSingle();
      if (svc.error) return NextResponse.json({ error: svc.error.message }, { status: 500 });
      if (svc.data) resolvedServiceId = svc.data.service_id;
    }

    const intakePayload = {
      customer_id: custId,
      plate_number,
      make,
      model,
      color,
      service_id: resolvedServiceId,
      vehicle_type_id: vehicle_type_id ?? null,
      downpayment: downpayment ?? 0,
      balance: balance ?? 0,
      payment_method,
      scheduled_date: scheduled_date ?? null,
      status: status ?? "pending",
    };

    const intakeRes = await admin
      .from("customer_intake")
      .insert(intakePayload)
      .select(INTAKE_SELECT)
      .single();

    if (intakeRes.error) return NextResponse.json({ error: intakeRes.error.message ?? String(intakeRes.error) }, { status: 500 });

    return NextResponse.json({ customer: customerRow, intake: intakeRes.data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
