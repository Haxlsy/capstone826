import { NextResponse } from "next/server"
import { getDashboardData } from "@/lib/operations/dashboard-data";
import { getRoleCaller } from "@/lib/auth/caller"

export async function GET() {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const data = await getDashboardData();
    return NextResponse.json(data)

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
