import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
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
      .eq("document_id", Number(id))
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stage_document: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
