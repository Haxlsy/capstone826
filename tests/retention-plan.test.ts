import { describe, it, expect } from "vitest"
import {
  addMonths,
  archivedAnchor,
  customerAnchor,
  daysUntilDeletion,
  deletionDate,
  digestAnchorRange,
  digestMessage,
  digestWindow,
  dueCutoff,
  expiringAnchorBound,
  graceEnd,
  inDigestWindow,
  isDue,
  isExpiringSoon,
  manilaWeekStart,
  type RetentionPolicy,
} from "@/lib/retention/plan"

const D = (s: string) => new Date(s)
const SIX: RetentionPolicy = { months: 6, changedAt: null }

describe("addMonths", () => {
  it("moves by calendar months and clamps to the month's end", () => {
    expect(addMonths(D("2026-01-15T10:00:00Z"), 6).toISOString()).toBe("2026-07-15T10:00:00.000Z")
    expect(addMonths(D("2026-08-31T00:00:00Z"), 6).toISOString()).toBe("2027-02-28T00:00:00.000Z")
    expect(addMonths(D("2027-08-31T00:00:00Z"), 6).toISOString()).toBe("2028-02-29T00:00:00.000Z")
    expect(addMonths(D("2026-07-15T00:00:00Z"), -6).toISOString()).toBe("2026-01-15T00:00:00.000Z")
  })
})

describe("deletion date and due", () => {
  it("each record has its own clock: anchor + the period", () => {
    expect(deletionDate("2026-01-10T00:00:00Z", SIX).toISOString()).toBe("2026-07-10T00:00:00.000Z")
    expect(deletionDate("2026-01-11T00:00:00Z", SIX).toISOString()).toBe("2026-07-11T00:00:00.000Z")
  })

  it("is due on the deletion date, not before", () => {
    expect(isDue("2026-01-10T00:00:00Z", SIX, D("2026-07-09T23:59:00Z"))).toBe(false)
    expect(isDue("2026-01-10T00:00:00Z", SIX, D("2026-07-10T00:00:00Z"))).toBe(true)
  })

  it("never deletes before the date it shows, even at month ends", () => {
    for (const anchor of ["2026-03-31T00:00:00Z", "2026-08-31T00:00:00Z", "2026-05-30T12:00:00Z"]) {
      const shown = deletionDate(anchor, SIX)
      expect(isDue(anchor, SIX, new Date(shown.getTime() - 1))).toBe(false)
      // ...and at most a few days after it.
      expect(isDue(anchor, SIX, new Date(shown.getTime() + 3 * 864e5))).toBe(true)
    }
  })

  it("holds everything for 14 days after the period changes", () => {
    const p: RetentionPolicy = { months: 3, changedAt: "2026-11-22T00:00:00Z" }
    expect(graceEnd(p)!.toISOString()).toBe("2026-12-06T00:00:00.000Z")
    // A year-old record that a 3-month period makes due at once:
    expect(isDue("2025-11-01T00:00:00Z", p, D("2026-12-05T00:00:00Z"))).toBe(false)
    expect(dueCutoff(p, D("2026-12-05T00:00:00Z"))).toBeNull()
    expect(isDue("2025-11-01T00:00:00Z", p, D("2026-12-06T00:00:00Z"))).toBe(true)
    expect(deletionDate("2025-11-01T00:00:00Z", p).toISOString()).toBe("2026-12-06T00:00:00.000Z")
  })

  it("counts whole days left", () => {
    expect(daysUntilDeletion("2026-01-10T00:00:00Z", SIX, D("2026-07-01T00:00:00Z"))).toBe(9)
  })
})

describe("expiring soon", () => {
  const now = D("2026-07-01T00:00:00Z")
  it("is true within 30 days of deletion", () => {
    expect(isExpiringSoon("2026-01-20T00:00:00Z", SIX, now)).toBe(true)
    expect(isExpiringSoon("2026-02-15T00:00:00Z", SIX, now)).toBe(false)
    expect(isExpiringSoon(null, SIX, now)).toBe(false)
  })
  it("gives a query bound that never misses an expiring record", () => {
    const bound = expiringAnchorBound(SIX, now)!
    for (const a of ["2026-01-31T23:00:00Z", "2026-01-20T00:00:00Z", "2025-12-01T00:00:00Z"]) {
      if (isExpiringSoon(a, SIX, now)) expect(D(a) <= bound).toBe(true)
    }
  })
  it("has no bound while the safety period outlasts the horizon", () => {
    expect(expiringAnchorBound({ months: 6, changedAt: "2026-07-01T00:00:00Z" }, now, 7)).toBeNull()
  })
})

describe("weekly digest", () => {
  it("weeks start Monday 00:00 in Manila", () => {
    // Sunday 22 Nov 2026, 10:00 Manila (02:00 UTC) is in the week of Mon 16 Nov.
    expect(manilaWeekStart(D("2026-11-22T02:00:00Z")).toISOString()).toBe("2026-11-15T16:00:00.000Z")
    // Monday 23 Nov, 00:30 Manila (Sunday 16:30 UTC) starts a new week.
    expect(manilaWeekStart(D("2026-11-22T16:30:00Z")).toISOString()).toBe("2026-11-22T16:00:00.000Z")
  })

  it("announces deletions 7 to 14 days after the Monday, and the windows tile", () => {
    const a = digestWindow(D("2026-11-23T01:00:00Z"))
    const b = digestWindow(D("2026-11-30T01:00:00Z"))
    expect((a.from.getTime() - a.weekStart.getTime()) / 864e5).toBe(7)
    expect(a.to.getTime()).toBe(b.from.getTime())
  })

  it("puts every deletion date in exactly one week's digest, at least 7 days ahead", () => {
    const weeks = Array.from({ length: 12 }, (_, i) => digestWindow(new Date(D("2026-11-23T01:00:00Z").getTime() + i * 7 * 864e5)))
    for (let day = 0; day < 60; day++) {
      const anchor = new Date(D("2026-05-20T05:00:00Z").getTime() + day * 864e5)
      const hits = weeks.filter((w) => inDigestWindow(anchor, SIX, w))
      const del = deletionDate(anchor, SIX)
      if (del >= weeks[0].from && del < weeks[weeks.length - 1].to) {
        expect(hits).toHaveLength(1)
        expect(del.getTime() - hits[0].weekStart.getTime()).toBeGreaterThanOrEqual(7 * 864e5)
      }
    }
  })

  it("narrows queries without missing records", () => {
    const w = digestWindow(D("2026-11-23T01:00:00Z"))
    const range = digestAnchorRange(SIX, w)!
    for (let day = -40; day < 40; day++) {
      const anchor = new Date(D("2026-06-01T00:00:00Z").getTime() + day * 864e5)
      if (inDigestWindow(anchor, SIX, w)) {
        expect(anchor <= range.upTo).toBe(true)
        expect(!range.after || anchor > range.after).toBe(true)
      }
    }
  })

  it("announces the backlog held by the safety period in the week it ends", () => {
    // Period changed (or retention went live) Sun 22 Nov: held to 6 Dec.
    const p: RetentionPolicy = { months: 6, changedAt: "2026-11-22T02:00:00Z" }
    const thisWeek = digestWindow(D("2026-11-23T01:00:00Z")) // covers 30 Nov to 7 Dec
    expect(inDigestWindow("2025-01-01T00:00:00Z", p, thisWeek)).toBe(true)
    expect(digestAnchorRange(p, thisWeek)!.after).toBeNull()
    // The week before has nothing (everything is held past its window).
    expect(digestAnchorRange(p, digestWindow(D("2026-11-16T01:00:00Z")))).toBeNull()
  })

  it("writes one message per role, or none when there's nothing", () => {
    const w = digestWindow(D("2026-11-23T01:00:00Z"))
    expect(digestMessage({ job_record: 15, technician: 0 }, w)).toBe(
      "15 records will be permanently deleted between Nov 30 and Dec 6 (15 job records). Export anything you need before then.",
    )
    expect(digestMessage({ customer: 1, inquiry: 8 }, w)).toContain("9 records")
    expect(digestMessage({ customer: 1, inquiry: 8 }, w)).toContain("1 customer, 8 inquiries")
    expect(digestMessage({ job_record: 0 }, w)).toBeNull()
  })
})

describe("anchors that depend on other records", () => {
  it("a customer's clock is their last activity, and never runs while a job is active", () => {
    const base = { created_at: "2025-01-01T00:00:00Z", updated_at: "2025-02-01T00:00:00Z", vehicle_created_at: ["2025-03-01T00:00:00Z"] }
    expect(customerAnchor({ ...base, jobs: [] })!.toISOString()).toBe("2025-03-01T00:00:00.000Z")
    expect(customerAnchor({ ...base, jobs: [{ status: "Released", created_at: "2025-04-01T00:00:00Z", released_at: "2025-05-01T00:00:00Z" }] })!.toISOString())
      .toBe("2025-05-01T00:00:00.000Z")
    expect(customerAnchor({ ...base, jobs: [{ status: "Ongoing", created_at: "2025-04-01T00:00:00Z", released_at: null }] })).toBeNull()
  })

  it("an archived item waits for the kept jobs that use it", () => {
    expect(archivedAnchor(null, [])).toBeNull()
    expect(archivedAnchor("2026-01-01T00:00:00Z", [])!.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(archivedAnchor("2026-01-01T00:00:00Z", [{ released_at: "2026-03-01T00:00:00Z" }])!.toISOString()).toBe("2026-03-01T00:00:00.000Z")
    expect(archivedAnchor("2026-01-01T00:00:00Z", [{ released_at: null }])).toBeNull()
  })
})
