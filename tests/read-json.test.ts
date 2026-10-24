import { describe, it, expect } from "vitest"
import { readJsonResponse } from "@/lib/client/read-json"

describe("readJsonResponse", () => {
  it("returns the parsed JSON body", async () => {
    const res = new Response(JSON.stringify({ approved: false, message: "Retake" }), { status: 400 })
    expect(await readJsonResponse(res)).toEqual({ approved: false, message: "Retake" })
  })

  it("turns a non-JSON error page (time limit) into a readable error", async () => {
    const res = new Response("An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT", { status: 504 })
    const json = await readJsonResponse(res)
    expect(json.error).toMatch(/took too long.*code 504/)
  })

  it("handles an empty body", async () => {
    const json = await readJsonResponse(new Response(null, { status: 502 }))
    expect(json.error).toMatch(/code 502/)
  })
})
