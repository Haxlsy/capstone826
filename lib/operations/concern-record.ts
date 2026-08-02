export interface ConcernRecord {
  id:            string
  title:         string
  description:   string
  status:        "Pending" | "Resolved"
  response_note: string | null
  submitted_at:  string
  jobId:         string       // display ID
  submitterName: string
  submitterRole: string
  stage_name?:   string | null
  media:         { id: string; file_url: string; media_type: string }[]
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

export function toConcernRecords(raw: unknown[]): ConcernRecord[] {
  return (raw ?? []).map((c: any) => ({
    id:            c.id,
    title:         c.title,
    description:   c.description,
    status:        (c.status as "Pending" | "Resolved"),
    response_note: c.response_note ?? null,
    submitted_at:  fmtDate(c.submitted_at),
    jobId:         c.job?.id
      ? `JO-${new Date(c.submitted_at ?? "").getFullYear()}-${c.job.id.slice(-4).toUpperCase()}`
      : "—",
    submitterName: c.submitter?.full_name ?? "—",
    submitterRole: c.submitter?.role ?? "—",
    stage_name:    c.stage_name ?? null,
    media:         (c.media ?? []).map((m: any) => ({
      id:         m.id,
      file_url:   m.file_url,
      media_type: m.media_type,
    })),
  }))
}
