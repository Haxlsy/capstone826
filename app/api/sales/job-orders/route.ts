import { NextResponse } from "next/server"
import { getJobOrdersData } from "@/lib/operations/job-orders-data"
import { getRoleCaller } from "@/lib/auth/caller"

// GET /api/sales/job-orders — Sales' read-only job order list. Same data
// Sales already gets server-side (app/dashboard/sales/job-orders/page.tsx);
// this is the client refetch behind SalesJobList, kept on a Sales-gated route
// so Sales never calls the Operations-only /api/operations/job-management/*.
export async function GET() {
  try {
    const auth = await getRoleCaller(["sales"])
    if ("error" in auth) return auth.error

    const data = await getJobOrdersData()
    return NextResponse.json({ job_orders: data.job_orders })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
