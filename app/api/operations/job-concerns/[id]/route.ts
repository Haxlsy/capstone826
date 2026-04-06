import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, admin_note, resolved_by_user_id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing concern ID" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updatePayload: any = {};
    if (status) updatePayload.status = status;
    if (admin_note !== undefined) updatePayload.admin_note = admin_note;
    if (resolved_by_user_id) {
      updatePayload.resolved_by_user_id = resolved_by_user_id;
      updatePayload.resolved_at = new Date().toISOString();
    }

    let { data, error } = await supabase
      .from("job_concern")
      .update(updatePayload)
      .eq("concern_id", Number(id))
      .select()
      .single();

    // Fallback to admin client if RLS blocks update
    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin
        .from("job_concern")
        .update(updatePayload)
        .eq("concern_id", Number(id))
        .select()
        .single();
      data = adminRes.data;
      error = (adminRes.error as any) ?? null;
    }

    if (error) {
      return NextResponse.json(
        { error: (error as any).message ?? String(error) },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, concern: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing concern ID" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from("job_concern")
      .select(
        `concern_id,
         job_order_id,
         submitted_by_user_id,
         resolved_by_user_id,
         concern_type,
         description,
         photo_url,
         status,
         admin_note,
         resolved_at,
         submitted_at,
         job_order:job_order_id(job_order_id, customer_id),
         submitted_by:submitted_by_user_id(user_id, full_name),
         resolved_by:resolved_by_user_id(user_id, full_name)`
      )
      .eq("concern_id", Number(id))
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ concern: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
