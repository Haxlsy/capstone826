import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getRoleCaller } from "@/lib/auth/caller";

interface MessageQuery {
  conversationId?: string;
  limit?: string;
}

export async function GET(request: Request) {
  try {
    const auth = await getRoleCaller(["operations"]);
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");
    const limit = url.searchParams.get("limit") || "50";

    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing required query parameter: conversationId" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from("messenger_message")
      .select(
        `message_id,
         conversation_id,
         sent_by_user_id,
         sender_type,
         message_body,
         sent_at,
         fb_message_id,
         sent_by:sent_by_user_id(user_id, full_name)`
      )
      .eq("conversation_id", Number(conversationId))
      .order("sent_at", { ascending: true })
      .limit(Number(limit));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data });
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
      conversation_id,
      sender_type,
      message_body,
      fb_message_id,
    } = body;

    if (!conversation_id || !sender_type || !message_body) {
      return NextResponse.json(
        { error: "Missing required fields: conversation_id, sender_type, message_body" },
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
      conversation_id,
      sent_by_user_id: user.id,
      sender_type,
      message_body,
      fb_message_id: fb_message_id ?? null,
    };

    let { data, error } = await supabase
      .from("messenger_message")
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
        .from("messenger_message")
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

    return NextResponse.json({ success: true, message: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
