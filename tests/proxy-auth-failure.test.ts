import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

// Defect: proxy.ts (this app's Edge middleware) called supabase.auth.getUser()
// with no try/catch. Production observed this throw an uncaught
// `AuthApiError: Request rate limit reached` instead of resolving to
// { error } — and since this function gates nearly every navigation with no
// error boundary of its own, the whole app went down with no HTTP response at
// all (the browser's native "This page couldn't load", not even a Next.js
// error page) until the outage cleared. This asserts the fix: a thrown
// getUser() no longer force-logs-out a request to a protected route.
const getUser = vi.fn()

vi.mock("@/lib/supabase/middleware-client", () => ({
  createClient: (request: NextRequest) => ({
    supabase: { auth: { getUser } },
    supabaseResponse: NextResponse.next({ request: { headers: request.headers } }),
  }),
}))

beforeEach(() => {
  getUser.mockReset()
})

function protectedRequest(path = "/dashboard/sales") {
  const request = new NextRequest(new URL(path, "https://example.com"))
  request.cookies.set("sb-example-auth-token", "some-jwt")
  return request
}

describe("proxy() survives a Supabase Auth failure", () => {
  it("does not redirect to /login when auth.getUser() throws", async () => {
    getUser.mockRejectedValue(new Error("Request rate limit reached"))
    const { proxy } = await import("@/proxy")

    const response = await proxy(protectedRequest())

    expect(response.status).not.toBe(307)
    expect(response.headers.get("location")).toBeNull()
  })

  it("still redirects to /login when getUser() resolves with no user (real unauthenticated case)", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "Invalid session" } })
    const { proxy } = await import("@/proxy")

    const response = await proxy(protectedRequest())

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/login")
  })

  it("a request with no auth cookie at all never calls getUser() and is unaffected", async () => {
    const { proxy } = await import("@/proxy")
    const request = new NextRequest(new URL("/login", "https://example.com"))

    await proxy(request)

    expect(getUser).not.toHaveBeenCalled()
  })
})
