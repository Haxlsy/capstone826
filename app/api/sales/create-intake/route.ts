import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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
      downpayment,
      balance,
      payment_method,
      scheduled_date,
      status,
    } = body;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let custId = customer_id ?? null;
    let customerRow: any = null;

    // Create customer if no customer_id provided
    if (!custId) {
      let insertRes = await supabase
        .from("customer")
        .insert({ full_name, contact_number, email, home_address })
        .select()
        .single();

      if (insertRes.error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const adminRes = await admin.from("customer").insert({ full_name, contact_number, email, home_address }).select().single();
        insertRes = adminRes as any;
      }

      if (insertRes.error) {
        return NextResponse.json({ error: insertRes.error.message ?? String(insertRes.error) }, { status: 500 });
      }

      customerRow = insertRes.data;
      custId = customerRow.customer_id ?? customerRow.customerId ?? customerRow.id;
    }

    if (!custId) return NextResponse.json({ error: "unable to determine customer id" }, { status: 400 });

    // Resolve service id by name if provided
    let resolvedServiceId = service_id ?? null;
    if (!resolvedServiceId && service_name) {
      const svc = await supabase.from("service").select("service_id").eq("service_name", service_name).maybeSingle();
      if (svc.error) return NextResponse.json({ error: svc.error.message }, { status: 500 });
      if (svc.data) resolvedServiceId = svc.data.service_id;
    }

    let intakeRes = await supabase
      .from("customer_intake")
      .insert({
        customer_id: custId,
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
      })
      .select()
      .single();

    if (intakeRes.error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const adminRes = await admin.from("customer_intake").insert({
        customer_id: custId,
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
      }).select().single();
      intakeRes = adminRes as any;
    }

    if (intakeRes.error) return NextResponse.json({ error: intakeRes.error.message ?? String(intakeRes.error) }, { status: 500 });

    return NextResponse.json({ customer: customerRow, intake: intakeRes.data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
