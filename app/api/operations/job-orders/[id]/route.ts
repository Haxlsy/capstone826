import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobId = parseInt(id, 10);
    if (isNaN(jobId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: job, error: jobErr } = await supabase
      .from("job_order")
      .select(
        `job_order_id, plate_number, car_make, car_model, car_color,
         current_status, scheduled_start, scheduled_end, created_at, payment_amount,
         customer:customer_id(full_name),
         service:service_id(service_name),
         assigned_technician:assigned_technician_id(full_name)`
      )
      .eq("job_order_id", jobId)
      .single();

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [{ data: logs }, { data: docs }] = await Promise.all([
      supabase
        .from("status_log")
        .select("old_status, new_status, changed_at, remarks, changer:changed_by_user_id(full_name)")
        .eq("job_order_id", jobId)
        .order("changed_at", { ascending: true }),
      supabase
        .from("job_stage_documentation")
        .select("stage_template_id, stage_status, created_at, template:stage_template_id(stage_name)")
        .eq("job_order_id", jobId),
    ]);

    const j = job as any;
    const year = j.created_at ? new Date(j.created_at).getFullYear() : new Date().getFullYear();
    const STATUS_LABEL: Record<string, string> = {
      pending: "Pending", ongoing: "Ongoing", quality_check: "Quality Check",
      completed: "Completed", delayed: "Delayed", cancelled: "Cancelled", released: "Released",
    };

    const history = [
      {
        status: STATUS_LABEL[j.current_status] ?? j.current_status,
        time: new Date(j.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
        actor: "System — Auto-created",
      },
      ...(logs ?? []).map((l: any) => ({
        status: STATUS_LABEL[l.new_status] ?? l.new_status,
        time: new Date(l.changed_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
        actor: l.changer?.full_name ?? "System",
      })),
    ];

    const stages = (docs ?? []).map((d: any) => ({
      name: (d.template as any)?.stage_name ?? `Stage ${d.stage_template_id}`,
      date: new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      done: d.stage_status === "done",
    }));

    return NextResponse.json({
      job: {
        id: `JO-${year}-${String(j.job_order_id).padStart(3, "0")}`,
        customer: j.customer?.full_name ?? "—",
        vehicle: j.plate_number ?? "—",
        service: j.service?.service_name ?? "—",
        technician: j.assigned_technician?.full_name ?? "Unassigned",
        status: STATUS_LABEL[j.current_status] ?? j.current_status,
        created: new Date(j.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        completed: j.scheduled_end ? new Date(j.scheduled_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null,
        history,
        stages,
        documentation: (docs ?? []).length,
      },
    });
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
    const jobId = parseInt(id, 10);
    if (isNaN(jobId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await request.json();
    const { status, assigned_technician_id, scheduled_start, scheduled_end, remarks } = body;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: currentJob } = await supabase
      .from("job_order")
      .select("current_status")
      .eq("job_order_id", jobId)
      .single();

    const updates: Record<string, any> = {};
    if (status !== undefined) updates.current_status = status;
    if (assigned_technician_id !== undefined) updates.assigned_technician_id = assigned_technician_id;
    if (scheduled_start !== undefined) updates.scheduled_start = scheduled_start;
    if (scheduled_end !== undefined) updates.scheduled_end = scheduled_end;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    let { data, error } = await supabase
      .from("job_order")
      .update(updates)
      .eq("job_order_id", jobId)
      .select()
      .single();

    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin
        .from("job_order")
        .update(updates)
        .eq("job_order_id", jobId)
        .select()
        .single();
      data = adminRes.data;
      error = (adminRes.error as any) ?? null;
    }

    if (error) return NextResponse.json({ error: (error as any).message ?? String(error) }, { status: 500 });

    // Log status change to status_log
    if (status && currentJob?.current_status && currentJob.current_status !== status && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      await admin.from("status_log").insert({
        job_order_id: jobId,
        old_status: currentJob.current_status,
        new_status: status,
        changed_by_user_id: user.id,
        remarks: remarks ?? null,
      });
    }

    return NextResponse.json({ job_order: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
