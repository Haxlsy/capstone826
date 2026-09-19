import { NextResponse } from "next/server"
import { getConcernsData } from "@/lib/sales/concerns-data"
import { toConcernRecords } from "@/lib/operations/concern-record"
import { getRoleCaller } from "@/lib/auth/caller"

// GET /api/sales/concerns — Sales' own read-only copy of the concerns list.
// Sales already receives this exact data server-side (app/dashboard/sales/
// concerns/page.tsx via lib/sales/concerns-data); this is only the client
// refetch behind hooks/use-concerns.ts, kept on a Sales-gated route so Sales
// never needs to call the Operations-only /api/operations/job-concerns.
export async function GET() {
  try {
    const auth = await getRoleCaller(["sales"])
    if ("error" in auth) return auth.error

    const { concerns } = await getConcernsData()
    return NextResponse.json({ concerns: toConcernRecords(concerns) })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
