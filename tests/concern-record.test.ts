import { describe, it, expect } from "vitest"
import { fmtDate, toConcernRecords } from "@/lib/operations/concern-record"
import { fmtTime } from "@/hooks/audit-helpers"

describe("concern time display is pinned to Asia/Manila", () => {
  it("shows a concern submitted at 06:37 UTC as 2:37 PM, not 6:37 AM", () => {
    const out = fmtDate("2026-09-26T06:37:00Z")
    expect(out).toContain("2:37")
    expect(out).toContain("PM")
    expect(out).not.toContain("6:37")
  })

  it("crosses to the next Manila day for a late-UTC instant", () => {
    expect(fmtDate("2026-09-26T20:30:00Z")).toContain("Sep 27, 2026")
  })

  it("toConcernRecords uses it for submitted_at", () => {
    const [r] = toConcernRecords([{ id: "c1", title: "t", description: "d", status: "Pending", submitted_at: "2026-09-26T06:37:00Z" }])
    expect(r.submitted_at).toContain("2:37")
  })

  it("the audit log time is Manila too", () => {
    expect(fmtTime("2026-09-26T06:37:00Z")).toContain("2:37")
  })

  it("a missing timestamp is a dash", () => {
    expect(fmtDate(null)).toBe("—")
  })
})
