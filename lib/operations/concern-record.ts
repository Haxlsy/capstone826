import { fmtDateTime } from "@/lib/time-display"

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

// Rendered on the server (UTC on Vercel), so the time zone MUST be pinned —
// fmtDateTime is Asia/Manila. A local, un-pinned formatter here showed a
// concern submitted at 2:37 PM as 6:37 AM.
export const fmtDate = fmtDateTime

export function toConcernRecords(raw: unknown[]): ConcernRecord[] {
  return (raw ?? []).map((c: any) => ({
    id:            c.id,
    title:         c.title,
    description:   c.description,
    status:        (c.status as "Pending" | "Resolved"),
    response_note: c.response_note ?? null,
    submitted_at:  fmtDate(c.submitted_at),
    jobId:         c.job?.job_order_code ?? "—",
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
