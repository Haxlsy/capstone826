import { NextResponse } from "next/server"
import { getConcernsData } from "@/lib/operations/concerns-data"
import { toConcernRecords } from "@/lib/operations/concern-record"
import { getRoleCaller } from "@/lib/auth/caller"

export async function GET() {
  try {
    const auth = await getRoleCaller(["operations"])
    if ("error" in auth) return auth.error

    const { concerns } = await getConcernsData()
    return NextResponse.json({ concerns: toConcernRecords(concerns) })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
