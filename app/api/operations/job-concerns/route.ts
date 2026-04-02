import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET() {
  try {
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
      .order("submitted_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ concerns: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      job_order_id,
      concern_type,
      description,
      photo_url,
    } = body;

    if (!job_order_id || !concern_type || !description) {
      return NextResponse.json(
        { error: "Missing required fields: job_order_id, concern_type, description" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = {
      job_order_id,
      submitted_by_user_id: user.id,
      concern_type,
      description,
      photo_url: photo_url ?? null,
      status: "open",
    };

    let { data, error } = await supabase
      .from("job_concern")
      .insert([payload])
      .select()
      .single();

    // Fallback to admin client if RLS blocks insert
    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin
        .from("job_concern")
        .insert([payload])
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

    return NextResponse.json({ success: true, concern: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
