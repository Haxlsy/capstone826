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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: jobs, error } = await supabase
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
         service:service_id(service_name)`
      )
      .eq("assigned_technician_id", user.id)
      .order("scheduled_start", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const jobsWithStages = await Promise.all(
      (jobs ?? []).map(async (job: any) => {
        const { data: templates } = await supabase
          .from("service_stage_template")
          .select("stage_template_id, stage_name, stage_order")
          .eq("service_id", job.service_id)
          .order("stage_order", { ascending: true });

        const { data: docs } = await supabase
          .from("job_stage_documentation")
          .select("stage_template_id, stage_status, created_at")
          .eq("job_order_id", job.job_order_id);

        const docsMap = new Map((docs ?? []).map((d: any) => [d.stage_template_id, d]));
        const tmplList = templates ?? [];
        const doneCount = (docs ?? []).filter((d: any) => d.stage_status === "done").length;

        const stages = tmplList.map((t: any, idx: number) => {
          const doc = docsMap.get(t.stage_template_id) as any;
          let status: "completed" | "active" | "pending";
          if (doc?.stage_status === "done") status = "completed";
          else if (idx === doneCount && job.current_status === "ongoing") status = "active";
          else status = "pending";

          return {
            name: t.stage_name,
            status,
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

        const year = job.scheduled_start
          ? new Date(job.scheduled_start).getFullYear()
          : new Date().getFullYear();

        return {
          job_id: `JO-${year}-${String(job.job_order_id).padStart(3, "0")}`,
          raw_id: job.job_order_id,
          name: job.customer?.full_name ?? "Unknown",
          plate_number: job.plate_number ?? "—",
          car_make: `${job.car_make ?? ""} ${job.car_model ?? ""}`.trim() || "—",
          car_color: job.car_color ?? "—",
          service: job.service?.service_name ?? "—",
          scheduled_start: job.scheduled_start
            ? new Date(job.scheduled_start).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "—",
          status: STATUS_MAP[job.current_status] ?? "Pending",
          progress: Math.round((doneCount / (tmplList.length || 1)) * 100),
          stages_label: `${doneCount} of ${tmplList.length} stages`,
          stages,
        };
      })
    );

    return NextResponse.json({ jobs: jobsWithStages });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
