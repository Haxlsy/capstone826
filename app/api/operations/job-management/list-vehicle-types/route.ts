import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getRoleCaller } from "@/lib/auth/caller";

export async function GET() {
  try {
    const auth = await getRoleCaller(["operations"]);
    if ("error" in auth) return auth.error;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let { data, error } = await supabase.from("vehicle_type").select("vehicle_type_id, type_name").order("type_name");

    // Fallback to admin client if RLS blocks or returns empty
    if ((error || !data || data.length === 0) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const adminRes = await admin.from("vehicle_type").select("vehicle_type_id, type_name").order("type_name");
      data = adminRes.data;
      error = adminRes.error ?? null;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ vehicle_types: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
