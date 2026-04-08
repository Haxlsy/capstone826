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
         service:service_id(service_name),
         assigned_technician:assigned_technician_id(full_name)`
      )
      .not("assigned_technician_id", "is", null)
      .order("scheduled_start", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const jobsWithProgress = await Promise.all(
      (jobs ?? []).map(async (job: any) => {
        const { data: templates } = await supabase
          .from("service_stage_template")
          .select("stage_template_id")
          .eq("service_id", job.service_id);

        const { data: docs } = await supabase
          .from("job_stage_documentation")
          .select("stage_template_id, stage_status")
          .eq("job_order_id", job.job_order_id);

        const totalStages = (templates ?? []).length;
        const doneCount = (docs ?? []).filter((d: any) => d.stage_status === "done").length;
        const progress = totalStages > 0 ? Math.round((doneCount / totalStages) * 100) : 0;

        const year = job.scheduled_start
          ? new Date(job.scheduled_start).getFullYear()
          : new Date().getFullYear();

        return {
          job_id: `JO-${year}-${String(job.job_order_id).padStart(3, "0")}`,
          raw_id: job.job_order_id,
          customer_name: job.customer?.full_name ?? "Unknown",
          plate_number: job.plate_number ?? "—",
          car_make: `${job.car_make ?? ""} ${job.car_model ?? ""}`.trim() || "—",
          car_color: job.car_color ?? "—",
          service: job.service?.service_name ?? "—",
          technician_name: job.assigned_technician?.full_name ?? "Unassigned",
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
          progress,
        };
      })
    );

    return NextResponse.json({ jobs: jobsWithProgress });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
