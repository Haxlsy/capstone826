import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createHmac } from "crypto"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/webhook/facebook/route"

// The webhook route end to end, for the one thing that must hold before any
// message is processed: a delivery not signed with the Meta app's App Secret
// is refused. Uses an empty `entry` list so nothing touches the database.
const SECRET = "route-test-secret"
const BODY = '{"object":"page","entry":[]}'
const sign = (body: string) => "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex")

function post(body: string, signature?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (signature) headers["x-hub-signature-256"] = signature
  return POST(new NextRequest("http://localhost/api/webhook/facebook", { method: "POST", headers, body }))
}

describe("POST /api/webhook/facebook signature check", () => {
  const previous = process.env.META_APP_SECRET
  beforeAll(() => { process.env.META_APP_SECRET = SECRET })
  afterAll(() => {
    if (previous === undefined) delete process.env.META_APP_SECRET
    else process.env.META_APP_SECRET = previous
  })

  it("accepts a correctly signed delivery", async () => {
    const res = await post(BODY, sign(BODY))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, handled: 0 })
  })

  it("refuses a delivery with no signature", async () => {
    expect((await post(BODY)).status).toBe(401)
  })

  it("refuses a delivery with the wrong signature", async () => {
    expect((await post(BODY, "sha256=" + "0".repeat(64))).status).toBe(401)
  })

  it("refuses a body changed after signing", async () => {
    expect((await post('{"object":"page","entry":[] }', sign(BODY))).status).toBe(401)
  })

  it("still accepts unsigned deliveries when no app secret is configured", async () => {
    delete process.env.META_APP_SECRET
    try {
      expect((await post(BODY)).status).toBe(200)
    } finally {
      process.env.META_APP_SECRET = SECRET
    }
  })
})
