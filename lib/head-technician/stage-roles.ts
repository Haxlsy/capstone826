import type { createAdminClient } from "@/lib/supabase/admin"
import type { StageRole } from "@/lib/head-technician/start-job"

/**
 * The (role, sequence) of every catalogue stage on a job — the same view the
 * head-technician job page builds (custom stages carry no category, so they
 * don't take part). Used to decide who may start the job.
 */
export async function loadJobStageRoles(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
): Promise<StageRole[]> {
  const { data: jsp } = await admin
    .from("job_stage_progress")
    .select("service_stage_id")
    .eq("job_order_id", jobId)
  const ssIds = (jsp ?? [])
    .map((s) => s.service_stage_id as string | null)
    .filter((id): id is string => Boolean(id))
  if (ssIds.length === 0) return []

  const { data: ss } = await admin
    .from("service_stage")
    .select("id, sequence_order, category_id")
    .in("id", ssIds)
  const catIds = [...new Set((ss ?? []).map((s) => s.category_id as string | null).filter(Boolean))] as string[]
  const roleByCat = new Map<string, string>()
  if (catIds.length > 0) {
    const { data: cats } = await admin
      .from("workflow_category")
      .select("id, technician_role")
      .in("id", catIds)
    for (const c of cats ?? []) roleByCat.set(c.id as string, c.technician_role as string)
  }
  return (ss ?? []).map((s) => ({
    role: roleByCat.get(s.category_id as string) ?? null,
    sequence: s.sequence_order as number,
  }))
}
