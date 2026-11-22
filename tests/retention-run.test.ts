import { describe, it, expect, vi, beforeEach } from "vitest"

// The run writes its summary through logAudit (which makes its own client);
// capture it instead.
const audits: { action: string; target?: string }[] = []
vi.mock("@/hooks/audit-helpers", () => ({
  logAudit: (p: { action: string; target?: string }) => { audits.push(p); return Promise.resolve() },
}))

const { runRetention, storagePathFromUrl, isDryRun } = await import("@/lib/retention/run")

// ── A tiny in-memory stand-in for the Supabase client ────────────────────────
// Supports exactly the query shapes lib/retention/run.ts uses, plus the
// database's delete rules that matter here (cascades and refusals).

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>

const ID_COL: Record<string, string> = { messenger_conversation: "conversation_id" }

function parseOr(expr: string): ((r: Row) => boolean) {
  const parts: string[] = []
  let depth = 0, cur = ""
  for (const ch of expr) {
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue }
    cur += ch
  }
  parts.push(cur)
  const clause = (c: string): ((r: Row) => boolean) => {
    if (c.startsWith("and(")) {
      const inner = c.slice(4, -1).split(",").map(clause)
      return (r) => inner.every((f) => f(r))
    }
    const [col, op, ...rest] = c.split(".")
    const val = rest.join(".")
    if (op === "is" && val === "null") return (r) => r[col] == null
    if (op === "lte") return (r) => r[col] != null && String(r[col]) <= val
    throw new Error(`unsupported or clause ${c}`)
  }
  const fs = parts.map(clause)
  return (r) => fs.some((f) => f(r))
}

class Query {
  private filters: ((r: Row) => boolean)[] = []
  private mode: "select" | "delete" = "select"
  private head = false
  private wantCount = false
  private lim: number | null = null
  private rng: [number, number] | null = null
  constructor(private db: FakeDb, private table: string) {}
  select(_cols?: string, opts?: { count?: string; head?: boolean }) { this.head = !!opts?.head; this.wantCount = !!opts?.count; return this }
  delete(opts?: { count?: string }) { this.mode = "delete"; this.wantCount = !!opts?.count; return this }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this }
  /** Only `.not(col, "is", null)` is used. */
  not(c: string) { this.filters.push((r) => r[c] != null); return this }
  lte(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) <= v); return this }
  lt(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) < v); return this }
  gt(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) > v); return this }
  gte(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) >= v); return this }
  in(c: string, vs: unknown[]) { const s = new Set(vs); this.filters.push((r) => s.has(r[c])); return this }
  or(expr: string) { this.filters.push(parseOr(expr)); return this }
  order() { return this }
  limit(n: number) { this.lim = n; return this }
  range(a: number, b: number) { this.rng = [a, b]; return this }
  maybeSingle() { return this.run().then((r) => ({ ...r, data: (r.data as Row[] | null)?.[0] ?? null })) }
  then<T>(ok: (v: { data: unknown; error: { message: string } | null; count: number | null }) => T, bad?: (e: unknown) => T) {
    return this.run().then(ok, bad)
  }
  private async run() {
    const rows = this.db.tables[this.table] ?? []
    let hit = rows.filter((r) => this.filters.every((f) => f(r)))
    if (this.mode === "delete") {
      const err = this.db.deleteRows(this.table, hit)
      return { data: null, error: err ? { message: err } : null, count: err ? null : hit.length }
    }
    const count = hit.length
    if (this.rng) hit = hit.slice(this.rng[0], this.rng[1] + 1)
    if (this.lim != null) hit = hit.slice(0, this.lim)
    return { data: this.head ? null : hit.map((r) => ({ ...r })), error: null, count: this.wantCount ? count : null }
  }
}

class FakeDb {
  removedFiles: string[] = []
  constructor(public tables: Tables) {}
  from(table: string) {
    const tables = this.tables
    const q = new Query(this, table)
    return Object.assign(q, {
      insert(rows: Row | Row[]) { tables[table] = [...(tables[table] ?? []), ...(Array.isArray(rows) ? rows : [rows])]; return Promise.resolve({ error: null }) },
      upsert(row: Row) {
        const list = (tables[table] ??= [])
        const dup = list.some((r) => r.record_type === row.record_type && r.record_id === row.record_id && r.delete_on === row.delete_on)
        if (!dup) list.push({ id: `n${list.length}`, notified_at: new Date().toISOString(), ...row })
        return { select: () => Promise.resolve({ data: dup ? [] : [{ id: "x" }], error: null }) }
      },
    })
  }
  storage = { from: (bucket: string) => ({ remove: async (paths: string[]) => { this.removedFiles.push(...paths.map((p) => `${bucket}/${p}`)); return { error: null } } }) }
  auth = { admin: { deleteUser: async (id: string) => {
    const rows = (this.tables.user_account ?? []).filter((r) => r.id === id)
    const err = this.deleteRows("user_account", rows)
    return { error: err ? { message: err } : null }
  } } }

  /** Applies the schema's delete rules; returns an error to refuse. */
  deleteRows(table: string, rows: Row[]): string | null {
    const idCol = ID_COL[table] ?? "id"
    const ids = new Set(rows.map((r) => r[idCol]))
    const t = this.tables
    const refused = (cond: boolean, msg: string) => (cond ? msg : null)
    const err =
      (table === "service" && refused((t.job_order ?? []).some((j) => ids.has(j.service_id)), "violates foreign key job_order_service_id_fkey")) ||
      (table === "user_account" && refused((t.concern ?? []).some((c) => ids.has(c.submitted_by_id)), "violates foreign key concern_submitted_by_id_fkey"))
    if (err) return err
    t[table] = (t[table] ?? []).filter((r) => !ids.has(r[idCol]))
    if (table === "job_order") {
      const stageIds = new Set((t.job_stage_progress ?? []).filter((s) => ids.has(s.job_order_id)).map((s) => s.id))
      const concernIds = new Set((t.concern ?? []).filter((c) => ids.has(c.job_order_id)).map((c) => c.id))
      t.job_stage_progress = (t.job_stage_progress ?? []).filter((s) => !ids.has(s.job_order_id))
      t.stage_media = (t.stage_media ?? []).filter((m) => !stageIds.has(m.job_stage_progress_id))
      t.concern = (t.concern ?? []).filter((c) => !ids.has(c.job_order_id))
      t.concern_media = (t.concern_media ?? []).filter((m) => !concernIds.has(m.concern_id))
      t.job_order_team = (t.job_order_team ?? []).filter((m) => !ids.has(m.job_order_id))
    }
    if (table === "customer") t.customer_record = (t.customer_record ?? []).filter((v) => !ids.has(v.customer_id))
    if (table === "technician") for (const m of t.job_order_team ?? []) if (ids.has(m.technician_id)) m.technician_id = null
    return null
  }
}

// ── Fixture: "today" is Tue 1 Dec 2026, 07:00 Manila; 6-month period,
// changed long ago (no safety period running).
const NOW = new Date("2026-11-30T23:00:00Z")
const OLD = "2026-01-10T00:00:00Z"      // > 6 months ago: due
const RECENT = "2026-10-01T00:00:00Z"   // kept
const URL_BASE = "https://x.supabase.co/storage/v1/object/public"

function fixture(): Tables {
  return {
    shop_config: [{ id: 1, retention_months: 6, retention_changed_at: "2025-01-01T00:00:00Z" }],
    job_order: [
      { id: "job-old", status: "Released", released_at: OLD, created_at: "2026-01-01T00:00:00Z", customer_record_id: "veh-old", service_id: "svc-archived" },
      { id: "job-new", status: "Released", released_at: RECENT, created_at: "2026-09-25T00:00:00Z", customer_record_id: "veh-kept", service_id: "svc-held" },
      { id: "job-active", status: "Ongoing", released_at: null, created_at: "2025-12-01T00:00:00Z", customer_record_id: "veh-active", service_id: "svc-held" },
    ],
    job_stage_progress: [{ id: "st1", job_order_id: "job-old" }],
    stage_media: [{ id: "m1", job_stage_progress_id: "st1", file_url: `${URL_BASE}/stage-media/job-old/st1/1.jpg` }],
    concern: [{ id: "c1", job_order_id: "job-old", submitted_by_id: "head-1" }],
    concern_media: [{ id: "cm1", concern_id: "c1", file_url: `${URL_BASE}/concern-media/c1/2.mp4` }],
    job_order_team: [
      { job_order_id: "job-old", technician_id: "tech-archived", user_account_id: null },
      { job_order_id: "job-new", technician_id: "tech-held", user_account_id: null },
    ],
    customer: [
      { id: "cust-old", created_at: OLD, updated_at: OLD },
      { id: "cust-kept", created_at: OLD, updated_at: OLD },        // has a recent job
      { id: "cust-active", created_at: OLD, updated_at: OLD },      // has an active job
    ],
    customer_record: [
      { id: "veh-old", customer_id: "cust-old", created_at: OLD },
      { id: "veh-kept", customer_id: "cust-kept", created_at: OLD },
      { id: "veh-active", customer_id: "cust-active", created_at: OLD },
    ],
    inquiry: [
      { id: "inq-old", resolved_at: OLD },
      { id: "inq-open", resolved_at: null },
      { id: "inq-new", resolved_at: RECENT },
    ],
    messenger_conversation: [
      { conversation_id: 1, status: "closed", last_message_at: OLD, created_at: OLD },
      { conversation_id: 2, status: "pending", last_message_at: OLD, created_at: OLD },
      { conversation_id: 3, status: "open", last_message_at: RECENT, created_at: OLD },
    ],
    technician: [
      { id: "tech-archived", is_archived: true, archived_at: OLD },
      { id: "tech-held", is_archived: true, archived_at: OLD },     // a kept job uses it
      { id: "tech-active", is_archived: false, archived_at: null },
    ],
    service: [
      { id: "svc-archived", is_archived: true, archived_at: OLD },  // only the old job uses it
      { id: "svc-held", is_archived: true, archived_at: OLD },      // kept and active jobs use it
    ],
    user_account: [
      { id: "head-1", role: "head_detailer", is_archived: true, archived_at: OLD },  // submitted c1
      { id: "ops-1", role: "operations", is_archived: false },
      { id: "sales-1", role: "sales", is_archived: false },
      { id: "admin-1", role: "admin", is_archived: false },
    ],
    audit_log: [
      { id: "a-old", created_at: OLD },
      { id: "a-new", created_at: RECENT },
    ],
    notification: [
      { id: "n-old", created_at: OLD, type: "job_status" },
      { id: "n-new", created_at: RECENT, type: "job_status" },
    ],
    retention_notice: [],
  }
}

const ids = (db: FakeDb, t: string) => (db.tables[t] ?? []).map((r) => r[ID_COL[t] ?? "id"])

beforeEach(() => { audits.length = 0 })

describe("runRetention", () => {
  it("dry run counts what is due and changes nothing", async () => {
    const db = new FakeDb(fixture())
    const before = JSON.stringify(db.tables.job_order) + JSON.stringify(db.tables.customer)
    const res = await runRetention(db as never, NOW, true)
    expect(res.dryRun).toBe(true)
    expect(res.counts).toMatchObject({ job_record: 1, customer: 1, inquiry: 1, conversation: 1, audit_log: 1, notification: 1 })
    expect(JSON.stringify(db.tables.job_order) + JSON.stringify(db.tables.customer)).toBe(before)
    expect(db.removedFiles).toEqual([])
    expect(audits[0].action).toMatch(/dry run/)
  })

  it("deletes what is due, files first, and keeps everything still in use", async () => {
    const db = new FakeDb(fixture())
    const res = await runRetention(db as never, NOW, false)

    expect(ids(db, "job_order")).toEqual(["job-new", "job-active"])
    expect(db.removedFiles.sort()).toEqual(["concern-media/c1/2.mp4", "stage-media/job-old/st1/1.jpg"])
    // The old customer goes; the ones with a recent or active job stay.
    expect(ids(db, "customer")).toEqual(["cust-kept", "cust-active"])
    expect(ids(db, "inquiry")).toEqual(["inq-open", "inq-new"])
    // Pending chats wait for staff; recent ones stay.
    expect(ids(db, "messenger_conversation")).toEqual([2, 3])
    // Archived items go only once no kept job uses them. tech-archived and
    // svc-archived were freed by deleting job-old in the same run.
    expect(ids(db, "technician")).toEqual(["tech-held", "tech-active"])
    expect(ids(db, "service")).toEqual(["svc-held"])
    // head-1's only concern went with job-old, so the account could go too.
    expect(ids(db, "user_account")).not.toContain("head-1")
    expect(ids(db, "audit_log")).toEqual(["a-new"])
    expect(ids(db, "notification").filter((i) => String(i).startsWith("n-"))).toEqual(["n-new"])
    // The kept job never lost its team.
    expect(db.tables.job_order_team).toEqual([{ job_order_id: "job-new", technician_id: "tech-held", user_account_id: null }])

    expect(res.counts).toMatchObject({ job_record: 1, customer: 1, inquiry: 1, conversation: 1, technician: 1, service: 1, user_account: 1 })
    expect(audits).toHaveLength(1)
    expect(audits[0].action).toBe("Data retention: deleted")
    expect(audits[0].target).toMatch(/^1 job record, 1 customer, 1 inquiry, 1 Messenger conversation, 1 archived technician, 1 archived service, 1 archived account, 1 audit trail entry, 1 notification \(kept 6 months\)$/)
  })

  it("skips a record the database refuses, and carries on", async () => {
    const t = fixture()
    // A concern from head-1 on a job that is still kept blocks the account.
    t.concern.push({ id: "c2", job_order_id: "job-new", submitted_by_id: "head-1" })
    const db = new FakeDb(t)
    await runRetention(db as never, NOW, false)
    expect(ids(db, "user_account")).toContain("head-1")
    expect(ids(db, "inquiry")).toEqual(["inq-open", "inq-new"])
  })

  it("deletes nothing while the 14-day safety period runs", async () => {
    const t = fixture()
    t.shop_config[0].retention_changed_at = "2026-11-25T00:00:00Z"
    const db = new FakeDb(t)
    const res = await runRetention(db as never, NOW, false)
    expect(res.counts).toEqual({})
    expect(ids(db, "job_order")).toHaveLength(3)
    expect(audits).toHaveLength(0)
  })

  it("sends one weekly digest per role, once, and only with something to say", async () => {
    const t = fixture()
    // Released 2 Jun: deleted 2 Dec... too soon for this week's digest
    // (7 to 14 days after Mon 30 Nov). Released 9 Jun: deleted 9 Dec, in it.
    t.job_order.push({ id: "job-digest", status: "Released", released_at: "2026-06-09T00:00:00Z", created_at: "2026-06-01T00:00:00Z", customer_record_id: null, service_id: "svc-held" })
    const db = new FakeDb(t)
    await runRetention(db as never, NOW, true)
    const sent = (db.tables.notification ?? []).filter((n) => n.type === "retention")
    expect(sent.map((n) => n.user_id)).toEqual(["ops-1"])
    expect(String(sent[0].message)).toMatch(/^1 record will be permanently deleted between Dec 7 and Dec 13 \(1 job record\)/)

    // A second run the same week sends nothing new.
    await runRetention(db as never, new Date(NOW.getTime() + 864e5), true)
    expect((db.tables.notification ?? []).filter((n) => n.type === "retention")).toHaveLength(1)
  })
})

describe("helpers", () => {
  it("reads storage paths from public URLs", () => {
    expect(storagePathFromUrl(`${URL_BASE}/stage-media/a/b/1.jpg?t=1`, "stage-media")).toBe("a/b/1.jpg")
    expect(storagePathFromUrl(`${URL_BASE}/concern-media/c%201/2.mp4`, "concern-media")).toBe("c 1/2.mp4")
    expect(storagePathFromUrl(`${URL_BASE}/other/x.jpg`, "stage-media")).toBeNull()
    expect(storagePathFromUrl(null, "stage-media")).toBeNull()
  })

  it("is a dry run unless RETENTION_DRY_RUN is exactly \"false\"", () => {
    expect(isDryRun({})).toBe(true)
    expect(isDryRun({ RETENTION_DRY_RUN: "0" })).toBe(true)
    expect(isDryRun({ RETENTION_DRY_RUN: "false" })).toBe(false)
  })
})
