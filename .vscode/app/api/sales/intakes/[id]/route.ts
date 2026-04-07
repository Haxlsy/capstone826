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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const intakeId = parseInt(id, 10);
    if (isNaN(intakeId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let { data, error } = await supabase
      .from("customer_intake")
      .select(INTAKE_SELECT)
      .eq("intake_id", intakeId)
      .single();

    if ((error || !data) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin
        .from("customer_intake")
        .select(INTAKE_SELECT)
        .eq("intake_id", intakeId)
        .single();
      data = adminRes.data;
      error = (adminRes.error as any) ?? null;
    }

    if (error) return NextResponse.json({ error: (error as any).message ?? String(error) }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Intake not found" }, { status: 404 });

    return NextResponse.json({ intake: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const intakeId = parseInt(id, 10);
    if (isNaN(intakeId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await request.json();
    const { status, scheduled_date } = body;

    const updates: Record<string, any> = {};
    if (status !== undefined) updates.status = status;
    if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date;
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let { data, error } = await supabase
      .from("customer_intake")
      .update(updates)
      .eq("intake_id", intakeId)
      .select()
      .single();

    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin
        .from("customer_intake")
        .update(updates)
        .eq("intake_id", intakeId)
        .select()
        .single();
      data = adminRes.data;
      error = (adminRes.error as any) ?? null;
    }

    if (error) return NextResponse.json({ error: (error as any).message ?? String(error) }, { status: 500 });

    return NextResponse.json({ intake: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
