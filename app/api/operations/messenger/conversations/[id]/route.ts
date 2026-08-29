import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getAuditCaller } from "@/lib/auth/caller";
import { logAuditCall } from "@/hooks/audit-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing conversation ID" }, { status: 400 });
    }

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
      .eq("conversation_id", Number(id))
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ conversation: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, handled_by_user_id, handler_role } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing conversation ID" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updatePayload: any = {};
    if (status) updatePayload.status = status;
    if (handled_by_user_id) updatePayload.handled_by_user_id = handled_by_user_id;
    if (handler_role) updatePayload.handler_role = handler_role;
    updatePayload.last_message_at = new Date().toISOString();

    // A human-owned (pending) or handed-off (closed) conversation must not keep
    // any in-flight AI flow state — otherwise the next customer message would
    // resume a stale booking/status flow (Phase 6 hardening).
    if (status === "pending" || status === "closed") {
      updatePayload.is_vehicle_inquiry    = false;
      updatePayload.is_booking_flow       = false;
      updatePayload.awaiting_confirmation = false;
      updatePayload.active_booking_offered = false;
      updatePayload.conflict_pending      = false;
    }

    let { data, error } = await supabase
      .from("messenger_conversation")
      .update(updatePayload)
      .eq("conversation_id", Number(id))
      .select()
      .single();

    // Fallback to admin client if RLS blocks update
    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin
        .from("messenger_conversation")
        .update(updatePayload)
        .eq("conversation_id", Number(id))
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
        category: "update",
        action:   "Updated messenger conversation",
        target:   `${(data as any)?.customer_name ?? `conversation ${id}`} (${status ?? "status change"})`,
      });
    }

    return NextResponse.json({ success: true, conversation: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
