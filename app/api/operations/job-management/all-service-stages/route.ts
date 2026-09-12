import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/operations/job-management/all-service-stages
// Bulk variant of service-stages/route.ts — every non-archived service's
// workflow stages in one response, keyed by service_id. Pre-warmed (see
// components/shared/ServiceWorkerRegistration.tsx) so Add Job Order has
// every service's stages available offline, not just whichever ones were
// individually selected on this device while online.
//
// Every known service id is seeded with `[]` even if it has zero stage rows,
// so the client can tell "genuinely no stages defined" (key present, empty)
// apart from "unknown to this snapshot" (key absent — e.g. a service created
// after the last online prewarm), which the empty per-service response alone
// can't distinguish.
export async function GET() {
  try {
    const admin = createAdminClient()

    const [{ data: services, error: servicesErr }, { data: rows, error: stagesErr }] = await Promise.all([
      admin.from("service").select("id").eq("is_archived", false),
      admin
        .from("service_stage")
        .select("id, service_id, name, sequence_order, stage_duration_mins, workflow_category(id, name, technician_role, display_color)")
        .order("service_id")
        .order("sequence_order"),
    ])

    if (servicesErr) return NextResponse.json({ error: servicesErr.message }, { status: 500 })
    if (stagesErr) return NextResponse.json({ error: stagesErr.message }, { status: 500 })

    const stagesByService: Record<string, unknown[]> = {}
    for (const s of services ?? []) stagesByService[s.id] = []

    for (const r of rows ?? []) {
      const cat = Array.isArray(r.workflow_category) ? r.workflow_category[0] : r.workflow_category
      const stage = {
        id:                  r.id,
        name:                r.name,
        sequence_order:      r.sequence_order,
        stage_duration_mins: (r as unknown as { stage_duration_mins: number }).stage_duration_mins ?? 0,
        category_id:         cat?.id ?? null,
        category_name:       cat?.name ?? null,
        category_role:       cat?.technician_role ?? null,
        category_color:      cat?.display_color ?? null,
      }
      ;(stagesByService[r.service_id] ??= []).push(stage)
    }

    return NextResponse.json({ stagesByService })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
