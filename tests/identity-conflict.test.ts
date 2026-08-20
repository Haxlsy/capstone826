import { describe, it, expect } from "vitest"
import {
  lookupIdentityConflict,
  namesCompatible,
  type IdentityConflict,
} from "@/lib/messenger/booking"
import type { CustomerDetails } from "@/types/chatbot"

const record = {
  full_name: "John Ashley Dulay",
  contact_number: "09123456789",
  plate_number: "ABC-123",
  vehicle_unit: "Ford",
  email: "john@example.com",
}

const caleb: CustomerDetails = {
  full_name: "Caleb James Dela Cruz",
  contact_number: "09123456789",
  plate_number: null,
  vehicle_unit: "Toyota",
  email: "caleb@example.com",
}

describe("Test 5 — identity conflict: name compatibility", () => {
  it("treats partial / variant names as compatible", () => {
    expect(namesCompatible("John Ashley Dulay", "John")).toBe(true)
    expect(namesCompatible("John Ashley Dulay", "John Ashley")).toBe(true)
    expect(namesCompatible("John Ashley Dulay", "JOHN DULAY")).toBe(true)
    expect(namesCompatible("John Ashley Dulay", "John Ashley Dulay")).toBe(true)
  })

  it("flags genuinely different names as a conflict", () => {
    expect(namesCompatible("John", "Caleb")).toBe(false)
    expect(namesCompatible("John Ashley Dulay", "Caleb James Dela Cruz")).toBe(false)
  })

  it("cannot compare when a name is empty", () => {
    expect(namesCompatible("", "John")).toBe(true)
  })
})

describe("Test 5 — identity conflict: detection", () => {
  it("returns null when there is nothing extracted", async () => {
    await expect(lookupIdentityConflict({ psid: "1", extracted: null, record })).resolves.toBeNull()
  })

  it("does not flag a name that matches the canonical record (no DB call)", async () => {
    const same: CustomerDetails = { ...caleb, full_name: "John Ashley Dulay" }
    await expect(
      lookupIdentityConflict({ psid: "1", extracted: same, record })
    ).resolves.toBeNull()
  })

  it("detects a name conflict (no plate → no DB call)", async () => {
    const result: IdentityConflict | null = await lookupIdentityConflict({
      psid: "1",
      extracted: caleb,
      record,
    })
    expect(result).not.toBeNull()
    expect(result!.nameConflict).toBe(true)
    expect(result!.plateConflict).toBe(false)
    expect(result!.note).toContain("Identity conflict")
  })

  it("returns null for a brand-new customer (no record, no plate)", async () => {
    await expect(
      lookupIdentityConflict({ psid: "9", extracted: caleb, record: undefined })
    ).resolves.toBeNull()
  })
})