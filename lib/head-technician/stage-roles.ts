import type { createAdminClient } from "@/lib/supabase/admin"
import type { StageRole } from "@/lib/head-technician/start-job"
import { STAGE_OVERRIDE_COLUMNS, loadStageCatalog, resolveJobStage, type JobStageRow } from "@/lib/job-stages"

/**
 * The (role, sequence) of every stage on a job, resolved through
 * lib/job-stages.ts so stages reordered or added for this job count the same
 * way they do on the head-technician job page. Used to decide who may start
 * the job. A stage with no resolvable category has a null role.
 */
export async function loadJobStageRoles(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
): Promise<StageRole[]> {
  const { data: jsp } = await admin
    .from("job_stage_progress")
    .select(STAGE_OVERRIDE_COLUMNS)
    .eq("job_order_id", jobId)
  const rows = (jsp ?? []) as unknown as JobStageRow[]
  if (rows.length === 0) return []

  const catalog = await loadStageCatalog(admin, rows)
  return rows.map((row) => {
    const resolved = resolveJobStage(row, catalog)
    return {
      role: resolved.category?.technician_role ?? null,
      // Unordered stages sort last, so they never decide who starts.
      sequence: resolved.sequence_order ?? Number.POSITIVE_INFINITY,
    }
  })
}
