import { NextResponse } from "next/server"
import { getDashboardData } from "@/lib/operations/dashboard-data";

export async function GET() {
  try {
    
    const data = await getDashboardData();
    return NextResponse.json(data)

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
