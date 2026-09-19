import { describe, it, expect } from "vitest"
import { substituteRoleLabel, substituteAddedMessage } from "@/lib/substitute-label"

describe("substitute labels", () => {
  it("names the role being substituted", () => {
    expect(substituteRoleLabel("head_detailer")).toBe("Substitute Head Detailer")
    expect(substituteRoleLabel("head_installer")).toBe("Substitute Head Installer")
  })
  it("notification names the role and the job", () => {
    expect(substituteAddedMessage("head_installer", "JO-8X2K9F"))
      .toBe("You've been added as Substitute Head Installer for job JO-8X2K9F.")
  })
})
