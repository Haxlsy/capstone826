import { NextResponse } from "next/server"
import { requireAuditCaller } from "@/lib/auth/caller"
import { logAuditCall } from "@/hooks/audit-helpers"
import { isExportType, EXPORT_TYPE_ACTIONS } from "@/lib/audit/export-types"

// POST /api/audit/log-export
// Body: { exportType: keyof EXPORT_TYPE_ACTIONS, target?: string }
// Any signed-in role may call this — it only ever logs "I exported this kind
// of thing." user_id/user_name/role come from the caller's own session and
// category/action come from the fixed EXPORT_TYPE_ACTIONS map, never from the
// request body, so a client can't forge an arbitrary audit entry this way.
export async function POST(request: Request) {
  try {
    const result = await requireAuditCaller()
    if ("error" in result) return result.error

    const body = await request.json().catch(() => ({}))
    const { exportType, target } = body as { exportType?: unknown; target?: unknown }

    if (!isExportType(exportType)) {
      return NextResponse.json({ error: "Unknown export type." }, { status: 400 })
    }

    await logAuditCall(result.caller, {
      category: "export",
      action:   EXPORT_TYPE_ACTIONS[exportType],
      target:   typeof target === "string" ? target.slice(0, 200) : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
