import { describe, it, expect } from "vitest"
import { createHmac } from "crypto"
import { verifyMetaSignature } from "@/lib/messenger/signature"

const SECRET = "test-app-secret"
const BODY = '{"object":"page","entry":[{"messaging":[{"sender":{"id":"1"},"message":{"text":"Kumusta \\u00f1"}}]}]}'
const sign = (body: string | Buffer, secret = SECRET) =>
  "sha256=" + createHmac("sha256", secret).update(body).digest("hex")

describe("verifyMetaSignature", () => {
  it("accepts a body signed with the app secret", () => {
    expect(verifyMetaSignature(BODY, sign(BODY), SECRET)).toBe(true)
    expect(verifyMetaSignature(Buffer.from(BODY), sign(BODY), SECRET)).toBe(true)
  })

  it("accepts an uppercase hex signature", () => {
    const hex = sign(BODY).slice("sha256=".length).toUpperCase()
    expect(verifyMetaSignature(BODY, "sha256=" + hex, SECRET)).toBe(true)
  })

  it("rejects a body that was changed after signing", () => {
    expect(verifyMetaSignature(BODY.replace("Kumusta", "Hello"), sign(BODY), SECRET)).toBe(false)
  })

  it("rejects a signature made with a different secret", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, "someone-elses-secret"), SECRET)).toBe(false)
  })

  it("rejects a missing header", () => {
    expect(verifyMetaSignature(BODY, null, SECRET)).toBe(false)
    expect(verifyMetaSignature(BODY, undefined, SECRET)).toBe(false)
    expect(verifyMetaSignature(BODY, "", SECRET)).toBe(false)
  })

  it("rejects a malformed header without throwing", () => {
    const hex = sign(BODY).slice("sha256=".length)
    expect(verifyMetaSignature(BODY, hex, SECRET)).toBe(false)              // no prefix
    expect(verifyMetaSignature(BODY, "sha1=" + hex, SECRET)).toBe(false)    // wrong algorithm
    expect(verifyMetaSignature(BODY, "sha256=abc123", SECRET)).toBe(false)  // too short
    expect(verifyMetaSignature(BODY, "sha256=" + "z".repeat(64), SECRET)).toBe(false) // not hex
  })

  it("rejects everything when no app secret is given", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, ""), "")).toBe(false)
  })
})
