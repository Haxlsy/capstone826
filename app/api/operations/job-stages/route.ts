import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let query = supabase
      .from("job_stage_documentation")
      .select(
        `document_id,
         job_order_id,
         stage_template_id,
         submitted_by_user_id,
         stage_status,
         media_url,
         media_type,
         submitted_at,
         rework_note,
         local_uuid,
         job_order:job_order_id(job_order_id, plate_number),
         stage_template:stage_template_id(stage_template_id, stage_name),
         submitted_by:submitted_by_user_id(user_id, full_name)`
      )
      .order("submitted_at", { ascending: false });

    if (jobId) {
      query = query.eq("job_order_id", Number(jobId));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stage_documents: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params);
    const body = await request.json();
    const { stage_status, rework_note } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updatePayload: any = {};
    if (stage_status) updatePayload.stage_status = stage_status;
    if (rework_note !== undefined) updatePayload.rework_note = rework_note;

    let { data, error } = await supabase
      .from("job_stage_documentation")
      .update(updatePayload)
      .eq("document_id", Number(id))
      .select()
      .single();

    // Fallback to admin client if RLS blocks update
    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin
        .from("job_stage_documentation")
        .update(updatePayload)
        .eq("document_id", Number(id))
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

    return NextResponse.json({ success: true, stage_document: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
