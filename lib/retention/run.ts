// Data retention: the daily job (app/api/cron/data-retention). Finds what is
// due, deletes it (photos and videos first), sends the weekly digest, and
// writes one audit entry. The date rules live in ./plan.ts.
//
// Safety:
//   - Dry run unless RETENTION_DRY_RUN is exactly "false": only counts and logs.
//   - Never deletes an active job, an unresolved inquiry, a customer with an
//     active job, or an archived item a kept job still uses (see plan.ts).
//   - A delete the database refuses (a link we didn't foresee) skips that one
//     record; it never stops the run.

import type { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/hooks/audit-helpers"
import { notifyRole } from "@/lib/notify-role"
import { DEFAULT_RETENTION_MONTHS, isRetentionMonths, type RetentionRecordType } from "./config"
import {
  archivedAnchor,
  countLabel,
  customerAnchor,
  digestAnchorRange,
  digestMessage,
  digestWindow,
  dueCutoff,
  inDigestWindow,
  type DigestWindow,
  type JobRef,
  type RetentionPolicy,
} from "./plan"

type Admin = ReturnType<typeof createAdminClient>

/** Rows fetched per page, and the most a single run looks at per table. */
const PAGE = 1000
const MAX_ROWS = 20_000
/** `.in(...)` lists are chunked so request URLs stay short. */
const CHUNK = 200

export function isDryRun(env: Record<string, string | undefined> = process.env): boolean {
  return env.RETENTION_DRY_RUN !== "false"
}

export async function loadRetentionPolicy(admin: Admin): Promise<RetentionPolicy> {
  const { data } = await admin
    .from("shop_config")
    .select("retention_months, retention_changed_at")
    .eq("id", 1)
    .maybeSingle()
  const months = isRetentionMonths(data?.retention_months) ? data!.retention_months : DEFAULT_RETENTION_MONTHS
  return { months, changedAt: (data?.retention_changed_at as string | null) ?? null }
}

const chunks = <T,>(items: T[], size = CHUNK): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Every page of a query, up to MAX_ROWS. `build` must return a fresh query. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(build: () => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

/**
 * The storage path inside `bucket` for one of its public URLs, or null:
 * ".../storage/v1/object/public/stage-media/<job>/<stage>/1.jpg" → "<job>/<stage>/1.jpg".
 */
export function storagePathFromUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null
  const marker = `/${bucket}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0])
  return path || null
}

// ── Candidates: records with an anchor in (after, upTo] ─────────────────────
// Each returns { id, anchor } for the exact rules in plan.ts to finish.

export interface Candidate { id: string; anchor: Date }
interface Bounds { after: Date | null; upTo: Date }

const iso = (d: Date) => d.toISOString()
const within = (anchor: Date | null, b: Bounds) => !!anchor && anchor <= b.upTo && (!b.after || anchor > b.after)

async function jobRecordCandidates(admin: Admin, b: Bounds): Promise<Candidate[]> {
  const rows = await fetchAll<{ id: string; released_at: string }>(() => {
    let q = admin.from("job_order").select("id, released_at")
      .eq("status", "Released").not("released_at", "is", null).lte("released_at", iso(b.upTo))
    if (b.after) q = q.gt("released_at", iso(b.after))
    return q.order("released_at")
  })
  return rows.map((r) => ({ id: r.id, anchor: new Date(r.released_at) }))
}

async function inquiryCandidates(admin: Admin, b: Bounds): Promise<Candidate[]> {
  const rows = await fetchAll<{ id: string; resolved_at: string }>(() => {
    let q = admin.from("inquiry").select("id, resolved_at")
      .not("resolved_at", "is", null).lte("resolved_at", iso(b.upTo))
    if (b.after) q = q.gt("resolved_at", iso(b.after))
    return q.order("resolved_at")
  })
  return rows.map((r) => ({ id: r.id, anchor: new Date(r.resolved_at) }))
}

async function conversationCandidates(admin: Admin, b: Bounds): Promise<Candidate[]> {
  // A chat's clock is its last message (or when it opened, if none). Chats
  // waiting for staff ("pending") are never deleted.
  const upTo = iso(b.upTo)
  const rows = await fetchAll<{ conversation_id: number; last_message_at: string | null; created_at: string }>(() =>
    admin.from("messenger_conversation").select("conversation_id, last_message_at, created_at")
      .neq("status", "pending")
      .or(`last_message_at.lte.${upTo},and(last_message_at.is.null,created_at.lte.${upTo})`)
      .order("conversation_id"),
  )
  return rows
    .map((r) => ({ id: String(r.conversation_id), anchor: new Date(r.last_message_at ?? r.created_at) }))
    .filter((c) => within(c.anchor, b))
}

async function jobsByIds(admin: Admin, ids: string[]) {
  const out = new Map<string, { id: string; status: string; created_at: string; released_at: string | null; customer_record_id?: string | null; service_id?: string | null }>()
  for (const part of chunks([...new Set(ids)])) {
    const { data, error } = await admin.from("job_order")
      .select("id, status, created_at, released_at, customer_record_id, service_id").in("id", part)
    if (error) throw new Error(error.message)
    for (const j of data ?? []) out.set(j.id as string, j as never)
  }
  return out
}

async function customerCandidates(admin: Admin, b: Bounds): Promise<Candidate[]> {
  // Narrow by the customer row's own dates first; their vehicles and jobs
  // can only make the last activity LATER, never earlier.
  const upTo = iso(b.upTo)
  const customers = await fetchAll<{ id: string; created_at: string | null; updated_at: string | null }>(() =>
    admin.from("customer").select("id, created_at, updated_at")
      .or(`updated_at.lte.${upTo},and(updated_at.is.null,created_at.lte.${upTo})`)
      .order("id"),
  )
  if (customers.length === 0) return []

  const vehicles: { id: string; customer_id: string; created_at: string }[] = []
  for (const part of chunks(customers.map((c) => c.id))) {
    const { data, error } = await admin.from("customer_record").select("id, customer_id, created_at").in("customer_id", part)
    if (error) throw new Error(error.message)
    vehicles.push(...((data ?? []) as typeof vehicles))
  }
  const jobs: { status: string; created_at: string; released_at: string | null; customer_record_id: string }[] = []
  for (const part of chunks(vehicles.map((v) => v.id))) {
    const { data, error } = await admin.from("job_order")
      .select("status, created_at, released_at, customer_record_id").in("customer_record_id", part)
    if (error) throw new Error(error.message)
    jobs.push(...((data ?? []) as typeof jobs))
  }

  const vehiclesOf = new Map<string, typeof vehicles>()
  for (const v of vehicles) vehiclesOf.set(v.customer_id, [...(vehiclesOf.get(v.customer_id) ?? []), v])
  const jobsOf = new Map<string, typeof jobs>()
  for (const j of jobs) jobsOf.set(j.customer_record_id, [...(jobsOf.get(j.customer_record_id) ?? []), j])

  return customers.flatMap((c) => {
    const own = vehiclesOf.get(c.id) ?? []
    const anchor = customerAnchor({
      created_at: c.created_at,
      updated_at: c.updated_at,
      vehicle_created_at: own.map((v) => v.created_at),
      jobs: own.flatMap((v) => jobsOf.get(v.id) ?? []),
    })
    return anchor && within(anchor, b) ? [{ id: c.id, anchor }] : []
  })
}

type ArchivedTable = "user_account" | "technician" | "service"

async function archivedCandidates(admin: Admin, table: ArchivedTable, b: Bounds): Promise<Candidate[]> {
  const rows = await fetchAll<{ id: string; archived_at: string }>(() =>
    admin.from(table).select("id, archived_at")
      .eq("is_archived", true).not("archived_at", "is", null).lte("archived_at", iso(b.upTo))
      .order("archived_at"),
  )
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  // Which jobs still use each item (kept job records hold it back).
  const jobIdsOf = new Map<string, string[]>()
  const add = (itemId: string | null, jobId: string | null) => {
    if (!itemId || !jobId) return
    jobIdsOf.set(itemId, [...(jobIdsOf.get(itemId) ?? []), jobId])
  }
  for (const part of chunks(ids)) {
    if (table === "service") {
      const { data, error } = await admin.from("job_order").select("id, service_id").in("service_id", part)
      if (error) throw new Error(error.message)
      for (const j of data ?? []) add(j.service_id as string, j.id as string)
    } else {
      const col = table === "technician" ? "technician_id" : "user_account_id"
      const { data, error } = await admin.from("job_order_team").select(`job_order_id, ${col}`).in(col, part)
      if (error) throw new Error(error.message)
      for (const t of (data ?? []) as unknown as Record<string, string>[]) add(t[col], t.job_order_id)
      if (table === "user_account") {
        const { data: concerns, error: cErr } = await admin.from("concern").select("job_order_id, submitted_by_id").in("submitted_by_id", part)
        if (cErr) throw new Error(cErr.message)
        for (const c of concerns ?? []) add(c.submitted_by_id as string, c.job_order_id as string)
      }
    }
  }
  const jobs = await jobsByIds(admin, [...jobIdsOf.values()].flat())

  return rows.flatMap((r) => {
    const refs: JobRef[] = (jobIdsOf.get(r.id) ?? []).flatMap((id) => {
      const j = jobs.get(id)
      return j ? [{ released_at: j.status === "Released" ? j.released_at : null }] : []
    })
    const anchor = archivedAnchor(r.archived_at, refs)
    return anchor && within(anchor, b) ? [{ id: r.id, anchor }] : []
  })
}

// Tables cleared purely by age, counted and deleted by date range.
type AgeTable = "audit_log" | "notification"

async function countByAge(admin: Admin, table: AgeTable, b: Bounds, inclusive = true): Promise<number> {
  let q = admin.from(table).select("id", { count: "exact", head: true })
  q = inclusive ? q.lte("created_at", iso(b.upTo)) : q.lt("created_at", iso(b.upTo))
  if (b.after) q = q.gte("created_at", iso(b.after))
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

const CANDIDATES: Record<Exclude<RetentionRecordType, AgeTable>, (admin: Admin, b: Bounds) => Promise<Candidate[]>> = {
  job_record: jobRecordCandidates,
  customer: customerCandidates,
  inquiry: inquiryCandidates,
  conversation: conversationCandidates,
  user_account: (a, b) => archivedCandidates(a, "user_account", b),
  technician: (a, b) => archivedCandidates(a, "technician", b),
  service: (a, b) => archivedCandidates(a, "service", b),
}
type RowType = keyof typeof CANDIDATES

/** Order matters: job records go first, which frees the customers, accounts,
 *  technicians and services they were holding back. */
const DELETE_ORDER: RowType[] = ["job_record", "customer", "inquiry", "conversation", "technician", "service", "user_account"]

// ── Counts for a period: the Settings preview and "Expiring soon" ────────────

export type RetentionCounts = Partial<Record<RetentionRecordType, number>>

/** How many records of each kind have an anchor at or before `upTo`. */
export async function countAnchoredBefore(admin: Admin, upTo: Date): Promise<RetentionCounts> {
  const b = { after: null, upTo }
  const counts: RetentionCounts = {}
  for (const type of DELETE_ORDER) counts[type] = (await CANDIDATES[type](admin, b)).length
  counts.audit_log = await countByAge(admin, "audit_log", b)
  return counts
}

/** Customer ids whose anchor is at or before `upTo`, with their anchors: the
 *  Customer Records page's "Expiring soon" filter and badges. */
export async function customerAnchors(admin: Admin, ids: string[] | null, upTo: Date): Promise<Map<string, Date>> {
  const found = await customerCandidates(admin, { after: null, upTo })
  const wanted = ids ? new Set(ids) : null
  return new Map(found.filter((c) => !wanted || wanted.has(c.id)).map((c) => [c.id, c.anchor]))
}

// ── Deleting ────────────────────────────────────────────────────────────────

async function removeFiles(admin: Admin, bucket: string, urls: (string | null)[]) {
  const paths = urls.map((u) => storagePathFromUrl(u, bucket)).filter((p): p is string => !!p)
  for (const part of chunks(paths, 100)) {
    const { error } = await admin.storage.from(bucket).remove(part)
    if (error) console.error(`[retention] could not remove ${part.length} file(s) from ${bucket}:`, error.message)
  }
}

/** Deletes rows by id; when the batch is refused, retries one by one so a
 *  single blocked row doesn't hold back the rest. Returns how many went. */
async function deleteRows(admin: Admin, table: string, idColumn: string, ids: (string | number)[]): Promise<number> {
  let deleted = 0
  for (const part of chunks(ids)) {
    const { error, count } = await admin.from(table).delete({ count: "exact" }).in(idColumn, part)
    if (!error) { deleted += count ?? part.length; continue }
    for (const id of part) {
      const one = await admin.from(table).delete({ count: "exact" }).eq(idColumn, id)
      if (one.error) console.warn(`[retention] kept ${table} ${id}: ${one.error.message}`)
      else deleted += one.count ?? 1
    }
  }
  return deleted
}

async function deleteJobRecords(admin: Admin, jobIds: string[]): Promise<number> {
  let deleted = 0
  for (const part of chunks(jobIds)) {
    // Photos and videos first: deleting the rows would leave the files behind.
    const { data: stages } = await admin.from("job_stage_progress").select("id").in("job_order_id", part)
    const stageIds = (stages ?? []).map((s) => s.id as string)
    for (const sp of chunks(stageIds)) {
      const { data: media } = await admin.from("stage_media").select("file_url").in("job_stage_progress_id", sp)
      await removeFiles(admin, "stage-media", (media ?? []).map((m) => m.file_url as string | null))
    }
    const { data: concerns } = await admin.from("concern").select("id").in("job_order_id", part)
    const concernIds = (concerns ?? []).map((c) => c.id as string)
    for (const cp of chunks(concernIds)) {
      const { data: media } = await admin.from("concern_media").select("file_url").in("concern_id", cp)
      await removeFiles(admin, "concern-media", (media ?? []).map((m) => m.file_url as string | null))
    }
    // The job's stages, media rows, history, team, concerns and
    // notifications go with it (ON DELETE CASCADE).
    deleted += await deleteRows(admin, "job_order", "id", part)
  }
  return deleted
}

async function deleteAccounts(admin: Admin, ids: string[]): Promise<number> {
  let deleted = 0
  for (const id of ids) {
    // Deleting the login removes the account row too (it cascades from
    // auth.users). If the database refuses, the login is kept as well.
    const { error } = await admin.auth.admin.deleteUser(id)
    if (!error) { deleted++; continue }
    // No login left (only the row): delete the row itself.
    const row = await admin.from("user_account").delete({ count: "exact" }).eq("id", id)
    if (row.error) console.warn(`[retention] kept account ${id}: ${error.message}; ${row.error.message}`)
    else deleted += row.count ?? 0
  }
  return deleted
}

async function deleteByAge(admin: Admin, table: AgeTable, cutoff: Date): Promise<number> {
  let deleted = 0
  for (let i = 0; i < MAX_ROWS / PAGE; i++) {
    const { data, error } = await admin.from(table).select("id").lte("created_at", iso(cutoff)).limit(PAGE)
    if (error) throw new Error(error.message)
    const ids = (data ?? []).map((r) => r.id as string)
    if (ids.length === 0) break
    deleted += await deleteRows(admin, table, "id", ids)
    if (ids.length < PAGE) break
  }
  return deleted
}

async function deleteType(admin: Admin, type: RowType, ids: string[]): Promise<number> {
  switch (type) {
    case "job_record": return deleteJobRecords(admin, ids)
    case "user_account": return deleteAccounts(admin, ids)
    case "conversation": return deleteRows(admin, "messenger_conversation", "conversation_id", ids.map(Number))
    case "customer": return deleteRows(admin, "customer", "id", ids)   // vehicles cascade
    default: return deleteRows(admin, type, "id", ids)                  // inquiry, technician, service
  }
}

// ── The weekly digest ───────────────────────────────────────────────────────

/** Who is told about what. Archived technicians concern both. */
export const DIGEST_RECIPIENTS: { roles: string[]; types: RetentionRecordType[]; claim: RetentionRecordType }[] = [
  { roles: ["operations"], types: ["job_record", "technician"], claim: "job_record" },
  { roles: ["sales"], types: ["customer", "inquiry", "conversation"], claim: "customer" },
  { roles: ["admin", "super_admin"], types: ["audit_log", "user_account", "service", "technician"], claim: "audit_log" },
]

async function windowCounts(admin: Admin, policy: RetentionPolicy, w: DigestWindow): Promise<RetentionCounts> {
  const counts: RetentionCounts = {}
  const loose = digestAnchorRange(policy, w)
  if (!loose) return counts
  for (const type of DELETE_ORDER) {
    const found = await CANDIDATES[type](admin, loose)
    counts[type] = found.filter((c) => inDigestWindow(c.anchor, policy, w)).length
  }
  // Exact bounds for the count-only table, so weeks never overlap.
  const exact = digestAnchorRange(policy, w, 0)
  counts.audit_log = exact ? await countByAge(admin, "audit_log", exact, false) : 0
  return counts
}

async function sendDigest(admin: Admin, policy: RetentionPolicy, now: Date) {
  const w = digestWindow(now)
  const weekKey = w.weekStart.toISOString().slice(0, 10)
  let counts: RetentionCounts | null = null
  const sent: string[] = []
  for (const r of DIGEST_RECIPIENTS) {
    // Once per role per week, even if the job runs again (or Monday's run
    // failed and Tuesday's sends it).
    const { data: already } = await admin.from("retention_notice").select("id")
      .eq("record_type", r.claim).eq("record_id", `digest:${r.roles[0]}`).eq("delete_on", weekKey).maybeSingle()
    if (already) continue

    counts ??= await windowCounts(admin, policy, w)
    const mine = Object.fromEntries(r.types.map((t) => [t, counts![t] ?? 0]))
    const message = digestMessage(mine, w)

    const { data: claimed } = await admin.from("retention_notice")
      .upsert({ record_type: r.claim, record_id: `digest:${r.roles[0]}`, delete_on: weekKey },
        { onConflict: "record_type,record_id,delete_on", ignoreDuplicates: true })
      .select("id")
    if (!claimed || claimed.length === 0 || !message) continue
    for (const role of r.roles) await notifyRole(admin, role, { type: "retention", message })
    sent.push(r.roles[0])
  }
  return { week: weekKey, sentTo: sent }
}

// ── The run ─────────────────────────────────────────────────────────────────

export interface RetentionRunResult {
  dryRun: boolean
  months: number
  /** Records due (dry run) or deleted, per kind. */
  counts: RetentionCounts
  digest: { week: string; sentTo: string[] }
}

export async function runRetention(admin: Admin, now = new Date(), dryRun = isDryRun()): Promise<RetentionRunResult> {
  const policy = await loadRetentionPolicy(admin)
  const counts: RetentionCounts = {}
  const cutoff = dueCutoff(policy, now)

  if (cutoff) {
    const b = { after: null, upTo: cutoff }
    for (const type of DELETE_ORDER) {
      const due = await CANDIDATES[type](admin, b)
      if (due.length === 0) continue
      counts[type] = dryRun ? due.length : await deleteType(admin, type, due.map((c) => c.id))
    }
    for (const table of ["audit_log", "notification"] as const) {
      const n = dryRun ? await countByAge(admin, table, b) : await deleteByAge(admin, table, cutoff)
      if (n > 0) counts[table] = n
    }
    // Digest bookkeeping older than any period it could matter for.
    if (!dryRun) await admin.from("retention_notice").delete().lt("notified_at", new Date(now.getTime() - 400 * 864e5).toISOString())
  }

  const digest = await sendDigest(admin, policy, now)

  const summary = Object.entries(counts).map(([t, n]) => countLabel(t, n ?? 0)).join(", ")
  if (summary) {
    await logAudit({
      user_id: null,
      user_name: "System",
      role: "system",
      category: "delete",
      action: dryRun ? "Data retention (dry run): would delete" : "Data retention: deleted",
      target: `${summary} (kept ${policy.months} months)`,
    })
  }
  return { dryRun, months: policy.months, counts, digest }
}
