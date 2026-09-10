import { NextResponse } from "next/server"

// Cheap connectivity heartbeat for hooks/useOnlineStatus.ts — navigator.onLine
// only reliably reports "definitely offline" (radio off), not "actually has
// internet" (e.g. connected to wifi with no route out), so the client pings
// this alongside the online/offline browser events.
export async function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
}
