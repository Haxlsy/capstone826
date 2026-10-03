import { describe, it, expect, vi, beforeEach } from "vitest"

const insert = vi.fn()
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}))

import { logAudit } from "@/hooks/audit-helpers"

const params = { user_id: "u1", user_name: "Admin A", role: "admin", category: "auth" as const, action: "Reset account password" }

beforeEach(() => {
  insert.mockReset()
  vi.restoreAllMocks()
})

describe("logAudit", () => {
  it("inserts the row with target defaulted to an empty string", async () => {
    insert.mockReturnValue(Promise.resolve({ error: null }))
    logAudit(params)
    await Promise.resolve()
    expect(insert).toHaveBeenCalledWith({ ...params, target: "" })
  })

  it("returns a thenable so callers in a route handler can await the write", async () => {
    insert.mockReturnValue(Promise.resolve({ error: null }))
    const result = logAudit(params)
    expect(typeof result.then).toBe("function")
    await result
  })

  it("reports a failed insert (resolved { error }) without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    insert.mockReturnValue(Promise.resolve({ error: { message: "boom" } }))
    expect(() => logAudit(params)).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
    expect(spy).toHaveBeenCalledWith("[audit] insert failed:", "boom", "-", "Reset account password")
  })
})
