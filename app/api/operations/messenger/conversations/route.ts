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
      .from("messenger_conversation")
      .select(
        `conversation_id,
         handled_by_user_id,
         handler_role,
         psid,
         customer_name,
         status,
         is_vehicle_inquiry,
         last_message_at,
         created_at,
         handled_by:handled_by_user_id(user_id, full_name)`
      )
      .order("last_message_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversations: data });
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
      customer_name,
      psid,
      handler_role,
      handled_by_user_id,
      is_vehicle_inquiry,
    } = body;

    if (!customer_name) {
      return NextResponse.json(
        { error: "Missing required field: customer_name" },
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
      customer_name,
      psid: psid ?? null,
      handler_role: handler_role ?? null,
      handled_by_user_id: handled_by_user_id ?? user.id,
      is_vehicle_inquiry: is_vehicle_inquiry ?? false,
      status: "open",
    };

    let { data, error } = await supabase
      .from("messenger_conversation")
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
        .from("messenger_conversation")
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
        action:   "Opened messenger conversation",
        target:   customer_name,
      });
    }

    return NextResponse.json({ success: true, conversation: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
