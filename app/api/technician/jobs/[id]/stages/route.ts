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
    const jobId = parseInt(id, 10);
    if (isNaN(jobId)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 });

    const body = await request.json();
    const { stage_template_id, stage_status, media_url, media_type } = body;

    if (!stage_template_id || !stage_status) {
      return NextResponse.json(
        { error: "stage_template_id and stage_status are required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = {
      job_order_id: jobId,
      stage_template_id,
      stage_status,
      media_url: media_url ?? null,
      media_type: media_type ?? null,
      submitted_by_user_id: user.id,
    };

    let { data, error } = await supabase
      .from("job_stage_documentation")
      .upsert(payload, { onConflict: "job_order_id,stage_template_id" })
      .select()
      .single();

    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin
        .from("job_stage_documentation")
        .upsert(payload, { onConflict: "job_order_id,stage_template_id" })
        .select()
        .single();
      data = adminRes.data;
      error = (adminRes.error as any) ?? null;
    }

    if (error) return NextResponse.json({ error: (error as any).message ?? String(error) }, { status: 500 });

    return NextResponse.json({ documentation: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
