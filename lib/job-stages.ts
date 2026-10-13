import type { createAdminClient } from "@/lib/supabase/admin"

/**
 * How a job's stages are resolved, in one place.
 *
 * A job's stages start from its service's template (`service_stage`), but
 * Operations can rename, reorder, or add stages for one job when creating it.
 * Those overrides live on the `job_stage_progress` row itself:
 *
 *   custom_name            a different name for this job
 *   custom_sequence_order  this job's position for the stage
 *   custom_stage_category  the category NAME of a stage added for this job
 *                          only (such a row has no service_stage_id)
 *
 * Every screen must read a stage through `resolveJobStage`. Reading the
 * template alone showed an added stage as "0. Stage" under "preparation" on
 * the Head Technician page while Operations showed "Car Dry" under Detailer,
 * and left added stages out of progress counts and unlock rules.
 */

/** The override columns, for a job_stage_progress `select`. */
export const STAGE_OVERRIDE_COLUMNS = "service_stage_id, custom_name, custom_sequence_order, custom_stage_category"

export interface JobStageRow {
  service_stage_id: string | null
  custom_name?: string | null
  custom_sequence_order?: number | null
  custom_stage_category?: string | null
}

export interface TemplateStage {
  id: string
  name?: string | null
  sequence_order?: number | null
  stage_duration_mins?: number | null
  category_id?: string | null
}

export interface StageCategory {
  id: string
  name: string
  technician_role?: string | null
  display_color?: string | null
}

export interface StageCatalog {
  templates: Map<string, TemplateStage>
  categories: Map<string, StageCategory>
  categoriesByName: Map<string, StageCategory>
  categoriesByLowerName: Map<string, StageCategory>
}

export interface ResolvedStage {
  /** null only when the row has neither an override nor a template name. */
  name: string | null
  /** null only when the row has neither an override nor a template order. */
  sequence_order: number | null
  category: StageCategory | null
  /** The template's duration; the per-job override stays on the row itself. */
  template_duration_mins: number | null
}

export function buildStageCatalog(templates: TemplateStage[], categories: StageCategory[]): StageCatalog {
  const categoriesByLowerName = new Map<string, StageCategory>()
  // First one wins, so two categories differing only by case stay stable.
  for (const c of categories) {
    const key = c.name.trim().toLowerCase()
    if (!categoriesByLowerName.has(key)) categoriesByLowerName.set(key, c)
  }
  return {
    templates: new Map(templates.map((t) => [t.id, t])),
    categories: new Map(categories.map((c) => [c.id, c])),
    categoriesByName: new Map(categories.map((c) => [c.name, c])),
    categoriesByLowerName,
  }
}

/** A stage as the job actually defines it: overrides first, then the template. */
export function resolveJobStage(row: JobStageRow, catalog: StageCatalog): ResolvedStage {
  const template = row.service_stage_id ? catalog.templates.get(row.service_stage_id) ?? null : null

  let category: StageCategory | null = null
  if (template?.category_id) {
    category = catalog.categories.get(template.category_id) ?? null
  } else if (row.custom_stage_category) {
    category =
      catalog.categoriesByName.get(row.custom_stage_category) ??
      catalog.categoriesByLowerName.get(row.custom_stage_category.trim().toLowerCase()) ??
      null
  }

  return {
    name: row.custom_name ?? template?.name ?? null,
    sequence_order: row.custom_sequence_order ?? template?.sequence_order ?? null,
    category,
    template_duration_mins: template?.stage_duration_mins ?? null,
  }
}

/**
 * Loads what `resolveJobStage` needs for these rows: their template stages,
 * and every workflow category (a small shop-configuration table; all of it is
 * needed because an added stage names its category instead of linking it).
 */
export async function loadStageCatalog(
  admin: ReturnType<typeof createAdminClient>,
  rows: JobStageRow[],
): Promise<StageCatalog> {
  const templateIds = [...new Set(rows.map((r) => r.service_stage_id).filter((id): id is string => Boolean(id)))]
  const [templateResult, categoryResult] = await Promise.all([
    templateIds.length > 0
      ? admin
          .from("service_stage")
          .select("id, name, sequence_order, stage_duration_mins, category_id")
          .in("id", templateIds)
      : Promise.resolve({ data: [] as TemplateStage[] }),
    admin.from("workflow_category").select("id, name, technician_role, display_color"),
  ])
  return buildStageCatalog(
    (templateResult.data ?? []) as TemplateStage[],
    (categoryResult.data ?? []) as StageCategory[],
  )
}
