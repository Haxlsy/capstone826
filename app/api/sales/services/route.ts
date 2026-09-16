import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getRoleCaller } from "@/lib/auth/caller";

export async function GET() {
  try {
    const auth = await getRoleCaller(["sales"]);
    if ("error" in auth) return auth.error;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from("service")
      .select("service_id, service_name, price, estimated_duration_days")
      .eq("is_archived", false)
      .order("service_name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ services: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
