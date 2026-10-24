/**
 * Crew (detailer / installer) can be on several active job orders at once —
 * they work as a team, so being on one job no longer blocks another. Pickers
 * and the availability page show the count instead, so Operations can judge
 * the workload themselves.
 */
export function workloadLabel(activeJobs: number): string {
  if (activeJobs <= 0) return "Available"
  return `On ${activeJobs} job${activeJobs === 1 ? "" : "s"}`
}
