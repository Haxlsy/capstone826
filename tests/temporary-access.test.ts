import { describe, it, expect } from "vitest"
import {
  endOfManilaDay, isAccessExpired, tempHeadUsername, generateTempPassword,
  TEMP_PASSWORD_CHARS, headRoleForCrew,
} from "@/lib/auth/temporary-access"

describe("endOfManilaDay", () => {
  it("ends at 23:59:59.999 Manila time (15:59:59.999 UTC)", () => {
    // 10:00 Manila on Nov 7 = 02:00 UTC
    expect(endOfManilaDay(new Date("2026-11-07T02:00:00Z")).toISOString()).toBe("2026-11-07T15:59:59.999Z")
  })

  it("uses the Manila date when it differs from the UTC date", () => {
    // 20:00 UTC Nov 6 = 04:00 Manila Nov 7 → still Nov 7 in Manila
    expect(endOfManilaDay(new Date("2026-11-06T20:00:00Z")).toISOString()).toBe("2026-11-07T15:59:59.999Z")
    // 23:30 Manila Nov 7 = 15:30 UTC → same day
    expect(endOfManilaDay(new Date("2026-11-07T15:30:00Z")).toISOString()).toBe("2026-11-07T15:59:59.999Z")
    // 00:30 Manila Nov 8 = 16:30 UTC Nov 7 → next day
    expect(endOfManilaDay(new Date("2026-11-07T16:30:00Z")).toISOString()).toBe("2026-11-08T15:59:59.999Z")
  })
})

describe("isAccessExpired", () => {
  const now = new Date("2026-11-07T12:00:00Z")
  it("never expires without an expiry", () => {
    expect(isAccessExpired({ access_expires_at: null }, now)).toBe(false)
    expect(isAccessExpired(null, now)).toBe(false)
  })
  it("is valid before the expiry and blocked at/after it", () => {
    expect(isAccessExpired({ access_expires_at: "2026-11-07T15:59:59.999Z" }, now)).toBe(false)
    expect(isAccessExpired({ access_expires_at: "2026-11-07T11:00:00Z" }, now)).toBe(true)
    expect(isAccessExpired({ access_expires_at: now.toISOString() }, now)).toBe(true)
  })
})

describe("tempHeadUsername", () => {
  it("builds first.last without spaces, lowercased", () => {
    expect(tempHeadUsername("Jake", "Dela Cruz")).toBe("jake.delacruz")
  })
  it("adds a number when the username is taken", () => {
    expect(tempHeadUsername("Jake", "Mayores", ["jake.mayores"])).toBe("jake.mayores2")
    expect(tempHeadUsername("Jake", "Mayores", ["Jake.Mayores", "jake.mayores2"])).toBe("jake.mayores3")
  })
  it("is empty when a name part is missing", () => {
    expect(tempHeadUsername("Jake", "")).toBe("")
  })
})

describe("generateTempPassword", () => {
  it("is 10 easy-to-read characters", () => {
    for (let i = 0; i < 20; i++) {
      const p = generateTempPassword()
      expect(p).toHaveLength(10)
      expect([...p].every((c) => TEMP_PASSWORD_CHARS.includes(c))).toBe(true)
    }
  })
})

describe("headRoleForCrew", () => {
  it("maps crew roles to the head role they cover", () => {
    expect(headRoleForCrew("detailer")).toBe("head_detailer")
    expect(headRoleForCrew("installer")).toBe("head_installer")
    expect(headRoleForCrew("sales")).toBeNull()
  })
})
