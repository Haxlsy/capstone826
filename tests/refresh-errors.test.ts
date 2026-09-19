import { describe, it, expect } from "vitest"
import { isDeadSessionError } from "@/lib/auth/refresh-errors"

describe("isDeadSessionError", () => {
  it.each(["refresh_token_not_found", "refresh_token_already_used", "session_not_found"])(
    "treats code %s as a dead session",
    (code) => {
      expect(isDeadSessionError({ name: "AuthApiError", code, message: "x" })).toBe(true)
    },
  )

  it("recognises the message the logs show, even without a code", () => {
    expect(
      isDeadSessionError({ name: "AuthApiError", message: "Invalid Refresh Token: Refresh Token Not Found" }),
    ).toBe(true)
    expect(isDeadSessionError(new Error("Invalid Refresh Token: Already Used"))).toBe(true)
  })

  it("never treats a network blip / retryable error as a dead session", () => {
    expect(isDeadSessionError({ name: "AuthRetryableFetchError", message: "fetch failed", status: 0 })).toBe(false)
    expect(isDeadSessionError(new TypeError("Failed to fetch"))).toBe(false)
  })

  it("ignores unrelated auth errors", () => {
    expect(isDeadSessionError({ name: "AuthApiError", code: "invalid_credentials", message: "Invalid login credentials" })).toBe(false)
  })

  it("handles null, undefined and non-objects", () => {
    expect(isDeadSessionError(null)).toBe(false)
    expect(isDeadSessionError(undefined)).toBe(false)
    expect(isDeadSessionError("refresh token")).toBe(false)
  })
})
