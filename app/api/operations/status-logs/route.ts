import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getAuditCaller, getRoleCaller } from "@/lib/auth/caller";
import { logAuditCall } from "@/hooks/audit-helpers";

export async function GET(request: Request) {
  try {
    const auth = await getRoleCaller(["operations"]);
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let query = supabase
      .from("status_log")
      .select(
        `log_id,
         job_order_id,
         changed_by_user_id,
         old_status,
         new_status,
         changed_at,
         remarks,
         notified_operations,
         notified_sales,
         job_order:job_order_id(job_order_id, plate_number),
         changed_by:changed_by_user_id(user_id, full_name)`
      )
      .order("changed_at", { ascending: false });

    if (jobId) {
      query = query.eq("job_order_id", Number(jobId));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status_logs: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getRoleCaller(["operations"]);
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const {
      job_order_id,
      old_status,
      new_status,
      remarks,
    } = body;

    if (!job_order_id || !new_status) {
      return NextResponse.json(
        { error: "Missing required fields: job_order_id, new_status" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First, update the job_order's current_status
    const { error: updateError } = await supabase
      .from("job_order")
      .update({
        current_status: new_status,
        updated_at: new Date().toISOString(),
      })
      .eq("job_order_id", Number(job_order_id));

    if (updateError && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      await admin
        .from("job_order")
        .update({
          current_status: new_status,
          updated_at: new Date().toISOString(),
        })
        .eq("job_order_id", Number(job_order_id));
    }

    // Create status log entry
    const payload = {
      job_order_id: Number(job_order_id),
      changed_by_user_id: user.id,
      old_status: old_status ?? null,
      new_status,
      remarks: remarks ?? null,
      notified_operations: false,
      notified_sales: false,
    };

    let { data, error } = await supabase
      .from("status_log")
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
        .from("status_log")
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

    const caller = await getAuditCaller();
    if (caller) {
      logAuditCall(caller, {
        category: "update",
        action:   `Changed job status to ${new_status}`,
        target:   remarks ?? `job ${job_order_id} (${old_status ?? "?"} → ${new_status})`,
      });
    }

    return NextResponse.json({ success: true, status_log: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
