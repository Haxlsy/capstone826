import { describe, it, expect } from "vitest"
import { accountStatusBadge, temporaryHeadTag } from "@/lib/auth/temporary-access"

describe("temporaryHeadTag", () => {
  const now = new Date("2026-11-07T06:00:00Z") // 2:00 PM Manila

  it("is nothing for a regular account", () => {
    expect(temporaryHeadTag({ is_temporary_head: false, access_expires_at: null }, now)).toBeNull()
    expect(temporaryHeadTag(undefined, now)).toBeNull()
  })

  it("says until 11:59 PM while today's access is active", () => {
    expect(temporaryHeadTag({ is_temporary_head: true, access_expires_at: "2026-11-07T15:59:59.999Z" }, now))
      .toEqual({ label: "Temporary · until 11:59 PM", ended: false })
  })

  it("says access ended once it has expired", () => {
    expect(temporaryHeadTag({ is_temporary_head: true, access_expires_at: "2026-11-06T15:59:59.999Z" }, now))
      .toEqual({ label: "Temporary · access ended", ended: true })
  })
})


describe("accountStatusBadge (Account Management)", () => {
  const now = new Date("2026-11-07T06:00:00Z")

  it("archived wins over everything", () => {
    expect(accountStatusBadge({ is_archived: true, is_temporary_head: true }, now)).toEqual({ kind: "archived", label: "Archived" })
  })

  it("shows a temporary head's tag instead of Active", () => {
    expect(accountStatusBadge({ is_archived: false, is_temporary_head: true, access_expires_at: "2026-11-07T15:59:59.999Z" }, now))
      .toEqual({ kind: "temporary", label: "Temporary · until 11:59 PM", ended: false })
    expect(accountStatusBadge({ is_archived: false, is_temporary_head: true, access_expires_at: "2026-11-06T15:59:59.999Z" }, now))
      .toEqual({ kind: "temporary", label: "Temporary · access ended", ended: true })
  })

  it("is Active for a regular account", () => {
    expect(accountStatusBadge({ is_archived: false, is_temporary_head: false }, now)).toEqual({ kind: "active", label: "Active" })
  })
})
