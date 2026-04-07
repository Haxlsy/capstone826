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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: job, error } = await supabase
      .from("job_order")
      .select(
        `job_order_id,
         plate_number,
         car_make,
         car_model,
         car_color,
         current_status,
         scheduled_start,
         scheduled_end,
         service_id,
         customer:customer_id(full_name, contact_number),
         service:service_id(service_name)`
      )
      .eq("job_order_id", jobId)
      .eq("assigned_technician_id", user.id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const j = job as any;

    const { data: templates } = await supabase
      .from("service_stage_template")
      .select("stage_template_id, stage_name, stage_order, requires_photo, requires_video")
      .eq("service_id", j.service_id)
      .order("stage_order", { ascending: true });

    const { data: docs } = await supabase
      .from("job_stage_documentation")
      .select("stage_template_id, stage_status, media_url, created_at")
      .eq("job_order_id", jobId);

    const docsMap = new Map((docs ?? []).map((d: any) => [d.stage_template_id, d]));
    const tmplList = templates ?? [];
    const doneCount = (docs ?? []).filter((d: any) => d.stage_status === "done").length;

    const stages = tmplList.map((t: any, idx: number) => {
      const doc = docsMap.get(t.stage_template_id) as any;
      let status: "completed" | "active" | "pending";
      if (doc?.stage_status === "done") status = "completed";
      else if (idx === doneCount && j.current_status === "ongoing") status = "active";
      else status = "pending";

      return {
        stage_template_id: t.stage_template_id,
        name: t.stage_name,
        status,
        requires_photo: t.requires_photo,
        requires_video: t.requires_video,
        media_url: doc?.media_url ?? null,
        timestamp: doc?.created_at
          ? new Date(doc.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          : undefined,
      };
    });

    const year = j.scheduled_start
      ? new Date(j.scheduled_start).getFullYear()
      : new Date().getFullYear();

    return NextResponse.json({
      job: {
        job_id: `JO-${year}-${String(j.job_order_id).padStart(3, "0")}`,
        raw_id: j.job_order_id,
        name: j.customer?.full_name ?? "Unknown",
        plate_number: j.plate_number ?? "—",
        car_make: `${j.car_make ?? ""} ${j.car_model ?? ""}`.trim() || "—",
        car_color: j.car_color ?? "—",
        service: j.service?.service_name ?? "—",
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
        progress: Math.round((doneCount / (tmplList.length || 1)) * 100),
        stages_label: `${doneCount} of ${tmplList.length} stages`,
        stages,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
