import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const STATUS_MAP: Record<string, string> = {
  pending: "Pending",
  ongoing: "Ongoing",
  quality_check: "Quality Check",
  completed: "Completed",
  delayed: "Delayed",
  cancelled: "Cancelled",
  released: "Released",
};

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

    // Fetch job info — head tech can see any job, no user filter
    const { data: job, error: jobError } = await supabase
      .from("job_order")
      .select(
        `job_order_id,
         plate_number,
         car_make,
         car_model,
         car_color,
         current_status,
         scheduled_start,
         service_id,
         customer:customer_id(full_name),
         service:service_id(service_name),
         assigned_technician:assigned_technician_id(full_name)`
      )
      .eq("job_order_id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: jobError?.message ?? "Not found" }, { status: 404 });
    }

    const j = job as any;

    // Status timeline — chronological order
    const { data: statusLogs } = await supabase
      .from("status_log")
      .select(`new_status, changed_at, changed_by:changed_by_user_id(full_name)`)
      .eq("job_order_id", jobId)
      .order("changed_at", { ascending: true });

    const timeline = (statusLogs ?? []).map((log: any) => ({
      status: STATUS_MAP[log.new_status] ?? log.new_status,
      changed_at: new Date(log.changed_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      changed_by: log.changed_by?.full_name ?? null,
    }));

    // Stage templates for this service
    const { data: templates } = await supabase
      .from("service_stage_template")
      .select("stage_template_id, stage_name, stage_order")
      .eq("service_id", j.service_id)
      .order("stage_order", { ascending: true });

    // All stage docs for this job — multiple rows per stage are possible
    const { data: docs } = await supabase
      .from("job_stage_documentation")
      .select("stage_template_id, stage_status, media_url, media_type, submitted_at")
      .eq("job_order_id", jobId)
      .order("submitted_at", { ascending: true });

    // Group docs by stage
    const docsMap = new Map<number, any[]>();
    for (const doc of docs ?? []) {
      const key = doc.stage_template_id;
      if (!docsMap.has(key)) docsMap.set(key, []);
      docsMap.get(key)!.push(doc);
    }

    const stages = (templates ?? []).map((t: any) => {
      const stageDocs = docsMap.get(t.stage_template_id) ?? [];
      const isDone = stageDocs.some((d: any) => d.stage_status === "done");
      const latest = stageDocs[stageDocs.length - 1];

      return {
        stage_template_id: t.stage_template_id,
        name: t.stage_name,
        order: t.stage_order,
        done: isDone,
        submitted_at: latest?.submitted_at
          ? new Date(latest.submitted_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          : null,
        media: stageDocs
          .filter((d: any) => d.media_url)
          .map((d: any) => ({ url: d.media_url, type: d.media_type ?? "image" })),
      };
    });

    const year = j.scheduled_start
      ? new Date(j.scheduled_start).getFullYear()
      : new Date().getFullYear();

    return NextResponse.json({
      job: {
        job_id: `JO-${year}-${String(j.job_order_id).padStart(3, "0")}`,
        raw_id: j.job_order_id,
        customer_name: j.customer?.full_name ?? "Unknown",
        plate_number: j.plate_number ?? "—",
        car_make: `${j.car_make ?? ""} ${j.car_model ?? ""}`.trim() || "—",
        car_color: j.car_color ?? "—",
        service: j.service?.service_name ?? "—",
        technician_name: j.assigned_technician?.full_name ?? "Unassigned",
        scheduled_start: j.scheduled_start
          ? new Date(j.scheduled_start).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          : "—",
        status: STATUS_MAP[j.current_status] ?? "Pending",
        timeline,
        stages,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
