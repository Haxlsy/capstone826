import { describe, it, expect } from "vitest"
import { recipientFromVehicle } from "@/lib/messenger/recipient"

describe("recipientFromVehicle", () => {
  it("the owner's Messenger account first", () => {
    expect(recipientFromVehicle({ owner: { psid: "o" }, booked_by: { psid: "b" } })).toEqual({ psid: "o", via: "own" })
  })
  it("a booking for someone else goes to whoever booked it", () => {
    expect(recipientFromVehicle({ owner: { psid: null }, booked_by: { psid: "b" } })).toEqual({ psid: "b", via: "booked_by" })
  })
  it("nobody reachable → null", () => {
    expect(recipientFromVehicle({ owner: { psid: null }, booked_by: null })).toEqual({ psid: null, via: null })
    expect(recipientFromVehicle(null)).toEqual({ psid: null, via: null })
    expect(recipientFromVehicle(undefined)).toEqual({ psid: null, via: null })
  })
  it("accepts array-shaped embeds", () => {
    expect(recipientFromVehicle([{ owner: [{ psid: "o" }] }]).psid).toBe("o")
    expect(recipientFromVehicle([{ owner: [{ psid: null }], booked_by: [{ psid: "b" }] }]).via).toBe("booked_by")
  })
  it("relinking/unlinking follows automatically because it is a reference, not a copy", () => {
    const booker = { psid: "old" as string | null }
    const vehicle = { owner: { psid: null }, booked_by: booker }
    expect(recipientFromVehicle(vehicle).psid).toBe("old")
    booker.psid = "new"
    expect(recipientFromVehicle(vehicle).psid).toBe("new")
    booker.psid = null
    expect(recipientFromVehicle(vehicle).psid).toBeNull()
  })
})
