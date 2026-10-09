import { describe, it, expect } from "vitest"
import {
  isAuditSortColumn, isAuditSortDir, isAuditScope, toggleSort, dateRangeBounds,
} from "@/lib/admin/audit-log-query"
import { isViewType, VIEW_TYPE_ACTIONS } from "@/lib/audit/view-types"

describe("isAuditSortColumn", () => {
  it("accepts every allow-listed column", () => {
    for (const c of ["created_at", "user_name", "role", "action", "target"]) {
      expect(isAuditSortColumn(c)).toBe(true)
    }
  })

  it("rejects anything not in the allow-list — defends against passing a raw query param to .order()", () => {
    expect(isAuditSortColumn("id")).toBe(false)
    expect(isAuditSortColumn("created_at; drop table audit_log")).toBe(false)
    expect(isAuditSortColumn(null)).toBe(false)
    expect(isAuditSortColumn(undefined)).toBe(false)
  })
})

describe("isAuditSortDir", () => {
  it("accepts asc and desc only", () => {
    expect(isAuditSortDir("asc")).toBe(true)
    expect(isAuditSortDir("desc")).toBe(true)
    expect(isAuditSortDir("ASC")).toBe(false)
    expect(isAuditSortDir("")).toBe(false)
    expect(isAuditSortDir(null)).toBe(false)
  })
})

describe("isAuditScope", () => {
  it("accepts activity and security only", () => {
    expect(isAuditScope("activity")).toBe(true)
    expect(isAuditScope("security")).toBe(true)
    expect(isAuditScope("all")).toBe(false)
  })
})

describe("toggleSort", () => {
  it("sorts a newly-clicked column ascending", () => {
    expect(toggleSort({ sortBy: "created_at", sortDir: "desc" }, "user_name"))
      .toEqual({ sortBy: "user_name", sortDir: "asc" })
  })

  it("flips direction when the same column is clicked again", () => {
    expect(toggleSort({ sortBy: "role", sortDir: "asc" }, "role"))
      .toEqual({ sortBy: "role", sortDir: "desc" })
    expect(toggleSort({ sortBy: "role", sortDir: "desc" }, "role"))
      .toEqual({ sortBy: "role", sortDir: "asc" })
  })
})

describe("dateRangeBounds", () => {
  it("returns no bounds when neither date is given", () => {
    expect(dateRangeBounds(null, null)).toEqual({})
  })

  it("sets gte to the start of the from-date in Asia/Manila (+08:00), not UTC", () => {
    // A plain UTC day would drop anything added before 08:00 Manila on this
    // day — see lib/sales/customer-records-filter.ts's dateAddedBounds(),
    // the same convention this now matches.
    expect(dateRangeBounds("2026-10-05", null)).toEqual({
      gte: "2026-10-04T16:00:00.000Z",
    })
  })

  it("sets lt to the start of the day AFTER the to-date (Manila), making it inclusive", () => {
    expect(dateRangeBounds(null, "2026-10-05")).toEqual({
      lt: "2026-10-05T16:00:00.000Z",
    })
  })

  it("sets both bounds when given a full range", () => {
    expect(dateRangeBounds("2026-10-01", "2026-10-08")).toEqual({
      gte: "2026-09-30T16:00:00.000Z",
      lt:  "2026-10-08T16:00:00.000Z",
    })
  })

  it("rolls the inclusive upper bound correctly across a month boundary", () => {
    expect(dateRangeBounds(null, "2026-10-31")).toEqual({
      lt: "2026-10-31T16:00:00.000Z",
    })
  })
})

describe("isViewType / VIEW_TYPE_ACTIONS", () => {
  it("resolves every entry in the allow-list to a non-empty action string", () => {
    for (const key of Object.keys(VIEW_TYPE_ACTIONS)) {
      expect(isViewType(key)).toBe(true)
      expect(VIEW_TYPE_ACTIONS[key as keyof typeof VIEW_TYPE_ACTIONS]).toBeTruthy()
    }
  })

  it("rejects anything not in the allow-list — a client can't forge an arbitrary category/action this way", () => {
    expect(isViewType("admin")).toBe(false)
    expect(isViewType("delete")).toBe(false)
    expect(isViewType("")).toBe(false)
    expect(isViewType(null)).toBe(false)
    expect(isViewType(123)).toBe(false)
  })
})
