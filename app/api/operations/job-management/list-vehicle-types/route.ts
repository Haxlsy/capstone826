import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase.from("vehicle_type").select("vehicle_type_id, type_name").order("type_name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ vehicle_types: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
