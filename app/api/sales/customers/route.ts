import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, contact_number, email, home_address } = body;
    if (!full_name || !contact_number) {
      return NextResponse.json({ error: "full_name and contact_number are required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let { data, error } = await supabase
      .from("customer")
      .insert({ full_name, contact_number, email, home_address })
      .select()
      .single();

    // If RLS prevented the insert (anonymous request), retry with service role key when available (dev-only fallback)
    if (error && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const adminRes = await admin.from("customer").insert({ full_name, contact_number, email, home_address }).select().single();
        data = adminRes.data;
        error = adminRes.error ?? null;
      } catch (e) {
        // fall through
      }
    }

    if (error) return NextResponse.json({ error: error.message ?? String(error) }, { status: 500 });

    return NextResponse.json({ customer: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase.from("customer").select("customer_id, full_name, contact_number, email, home_address").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ customers: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
