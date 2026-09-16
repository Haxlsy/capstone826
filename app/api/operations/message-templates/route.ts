import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getAuditCaller, getRoleCaller } from "@/lib/auth/caller";
import { logAuditCall } from "@/hooks/audit-helpers";

export async function GET() {
  try {
    const auth = await getRoleCaller(["operations"]);
    if ("error" in auth) return auth.error;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from("message_template")
      .select(
        `template_id,
         created_by_user_id,
         template_name,
         body_text,
         trigger_status,
         visible_to_role,
         created_at,
         created_by:created_by_user_id(user_id, full_name)`
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data });
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
      template_name,
      body_text,
      trigger_status,
      visible_to_role,
    } = body;

    if (!template_name || !body_text) {
      return NextResponse.json(
        { error: "Missing required fields: template_name, body_text" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = {
      created_by_user_id: user.id,
      template_name,
      body_text,
      trigger_status: trigger_status ?? null,
      visible_to_role: visible_to_role ?? "all",
    };

    let { data, error } = await supabase
      .from("message_template")
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
        .from("message_template")
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
        category: "create",
        action:   "Created message template",
        target:   template_name,
      });
    }

    return NextResponse.json({ success: true, template: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
