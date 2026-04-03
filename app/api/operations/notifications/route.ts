import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("operations_notification")
      .select(
        `notif_id,
         job_order_id,
         status_log_id,
         sent_to_user_id,
         notification_type,
         message,
         is_read,
         created_at,
         job_order:job_order_id(job_order_id, plate_number),
         sent_to:sent_to_user_id(user_id, full_name),
         status_log:status_log_id(log_id, job_status)`
      )
      .eq("sent_to_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notifications: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      job_order_id,
      status_log_id,
      sent_to_user_id,
      notification_type,
      message,
    } = body;

    if (!sent_to_user_id || !notification_type) {
      return NextResponse.json(
        { error: "Missing required fields: sent_to_user_id, notification_type" },
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
      job_order_id: job_order_id ?? null,
      status_log_id: status_log_id ?? null,
      sent_to_user_id,
      notification_type,
      message: message ?? null,
      is_read: false,
    };

    let { data, error } = await supabase
      .from("operations_notification")
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
        .from("operations_notification")
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

    return NextResponse.json({ success: true, notification: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
