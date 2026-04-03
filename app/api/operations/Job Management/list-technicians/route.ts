import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get all active technicians (role = "technician", not archived)
    let { data: techs, error } = await supabase
      .from("profile")
      .select("user_id, full_name, role, is_online")
      .eq("role", "technician")
      .eq("is_archived", false)
      .order("full_name");

    // Fallback to admin client if RLS blocks or returns empty
    if ((error || !techs || techs.length === 0) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin
        .from("profile")
        .select("user_id, full_name, role, is_online")
        .eq("role", "technician")
        .eq("is_archived", false)
        .order("full_name");
      techs = adminRes.data;
      error = adminRes.error ?? null;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get active job counts per technician
    const { data: activeJobs } = await supabase
      .from("job_order")
      .select("assigned_technician_id")
      .in("current_status", ["pending", "ongoing", "quality_check", "delayed"])
      .not("assigned_technician_id", "is", null);

    const jobCountMap = new Map<string, number>();
    (activeJobs ?? []).forEach((j: any) => {
      const id = j.assigned_technician_id;
      jobCountMap.set(id, (jobCountMap.get(id) ?? 0) + 1);
    });

    const technicians = (techs ?? []).map((t: any) => ({
      user_id: t.user_id,
      full_name: t.full_name,
      role: t.role,
      is_online: t.is_online,
      active_jobs: jobCountMap.get(t.user_id) ?? 0,
    }));

    return NextResponse.json({ technicians });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
