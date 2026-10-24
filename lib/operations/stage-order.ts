/**
 * A job's stages run strictly by sequence number, and each category's stages
 * belong to one team (detailer or installer). So the stages of a category must
 * sit together: if a Preparation stage is numbered after the Installation
 * stages, the head detailer is blocked on it until the very end and every
 * "expected by" time after it shifts.
 *
 * Returns the stages with each category kept together — categories in the
 * order they first appear, stages in their existing order within a category.
 * Pure and stable; callers renumber the result 1..n.
 */
export function orderStagesByCategory<T>(
  stages: readonly T[],
  categoryKey: (stage: T) => string | null | undefined,
): T[] {
  const groups = new Map<string, T[]>()
  for (const stage of stages) {
    const key = categoryKey(stage) ?? ""
    const group = groups.get(key)
    if (group) group.push(stage)
    else groups.set(key, [stage])
  }
  return [...groups.values()].flat()
}
