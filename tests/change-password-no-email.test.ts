import { describe, it, expect, vi, beforeEach } from "vitest"

// Regression: an account with no email (allowed since email became optional)
// must be able to finish the forced password change after an admin reset,
// without being asked for an emailed code it can never receive.

let accountEmail: string | null = null
let totpFactors: { id: string }[] = []

const updateUserById = vi.fn(async () => ({ error: null }))
const createEmailChallenge = vi.fn(async () => ({ challengeId: "c1", method: "email", emailSent: true }))
const createTotpChallenge = vi.fn(async () => ({ challengeId: "c2", method: "totp" }))

/** Minimal chainable stand-in for a Supabase query: every builder method
 *  returns itself, `.single()` yields the account row, and awaiting the chain
 *  (e.g. an update) yields no error. */
function query() {
  const q = {
    select: () => q,
    update: () => q,
    eq: () => q,
    single: async () => ({ data: { full_name: "Juan Dela Cruz", email: accountEmail }, error: null }),
    then: (resolve: (v: { data: null; error: null }) => void) => resolve({ data: null, error: null }),
  }
  return q
}

vi.mock("next/headers", () => ({ cookies: async () => ({}) }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1", email: "juan.cruz@826autocare.internal" } } }),
      mfa: { listFactors: async () => ({ data: { totp: totpFactors } }) },
    },
  }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      signInWithPassword: async () => ({ error: null }),
      admin: { updateUserById },
    },
    from: () => query(),
  }),
}))
vi.mock("@/lib/auth/caller", () => ({ getAuditCaller: async () => null }))
vi.mock("@/hooks/audit-helpers", () => ({ logAuditCall: vi.fn() }))
vi.mock("@/lib/auth/mfa-challenge", () => ({
  hashMfaCode: (c: string) => c,
  MAX_MFA_ATTEMPTS: 5,
  createEmailChallenge,
  createTotpChallenge,
}))

const { POST } = await import("@/app/api/auth/change-password/route")

function changePassword() {
  return POST(new Request("http://localhost/api/auth/change-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ currentPassword: "TempPass123", newPassword: "NewPass12345" }),
  }))
}

describe("POST /api/auth/change-password for an account without email", () => {
  beforeEach(() => {
    accountEmail = null
    totpFactors = []
    vi.clearAllMocks()
  })

  it("changes the password directly, with no emailed code", async () => {
    const res = await changePassword()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })
    expect(json.mfaRequired).toBeUndefined()
    expect(createEmailChallenge).not.toHaveBeenCalled()
    expect(updateUserById).toHaveBeenCalledWith("u1", { password: "NewPass12345" })
  })

  it("still asks for an emailed code when the account has an email", async () => {
    accountEmail = "juan@example.com"
    const json = await (await changePassword()).json()
    expect(json).toMatchObject({ mfaRequired: true, method: "email" })
    expect(createEmailChallenge).toHaveBeenCalled()
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it("uses the authenticator app when one is set up, even with no email", async () => {
    totpFactors = [{ id: "f1" }]
    const json = await (await changePassword()).json()
    expect(json).toMatchObject({ mfaRequired: true, method: "totp" })
    expect(createEmailChallenge).not.toHaveBeenCalled()
  })
})
