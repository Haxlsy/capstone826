import { describe, it, expect } from "vitest"
import { redirectReasonFor } from "@/lib/auth/session-reasons"

describe("redirectReasonFor", () => {
  it("maps a superseded session to signed_in_elsewhere", () => {
    expect(redirectReasonFor("mismatch")).toBe("signed_in_elsewhere")
  })

  // Defect (TC-011): archiving an account never logged it out. The status
  // check must report it distinctly — otherwise the rotated session token
  // would surface as "mismatch" and tell the user they signed in elsewhere.
  it("maps an archived account to account_archived", () => {
    expect(redirectReasonFor("archived")).toBe("account_archived")
  })

  it("gives no reason for a deliberate logout or anything unrecognized", () => {
    expect(redirectReasonFor("no_session")).toBeNull()
    expect(redirectReasonFor(undefined)).toBeNull()
    expect(redirectReasonFor("<script>")).toBeNull()
  })
})
