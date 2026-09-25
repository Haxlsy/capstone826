export interface DetailBack {
  href: string
  label: string
}

const JOB_MANAGEMENT: DetailBack = {
  href: "/dashboard/job-management",
  label: "Back to Job Management",
}

// Whitelist only — `from` comes straight from the URL, so it must never be
// used as a redirect target itself, only as a key into this fixed map.
const ORIGINS: Record<string, DetailBack> = {
  records: { href: "/dashboard/job-order-records", label: "Back to Job Records" },
}

/**
 * Where the job detail page's "Back" link should go. The same page is reached
 * from both Job Management and Job Records, so the origin travels in `?from=`.
 * Anything unrecognized (missing, an array from a repeated param, or an
 * arbitrary string) falls back to Job Management.
 */
export function resolveDetailBack(from: string | string[] | undefined): DetailBack {
  if (typeof from !== "string") return JOB_MANAGEMENT
  return Object.prototype.hasOwnProperty.call(ORIGINS, from) ? ORIGINS[from] : JOB_MANAGEMENT
}
