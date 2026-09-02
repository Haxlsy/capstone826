import { describe, it, expect } from "vitest"
import { buildStageUpdateMessage } from "@/lib/messenger/stage-update"

const base = {
  customerName: "John Ashley Dulay",
  stageName: "Stage 2",
  categoryName: "Preparation",
  serviceName: "Graphene Coating",
  vehicleUnit: "SUV",
  plate: "ABC-826",
  completedCount: 2,
  totalCount: 6,
}

describe("buildStageUpdateMessage", () => {
  it("includes vehicle unit, plate, stage, category, service and progress", () => {
    const m = buildStageUpdateMessage(base)
    expect(m).toContain("your SUV (plate ABC-826)")
    expect(m).toContain('"Stage 2"')
    expect(m).toContain("Preparation stage")
    expect(m).toContain("Graphene Coating service")
    expect(m).toContain("Progress: 2 of 6 steps done.")
    expect(m).toContain("John Ashley Dulay")
  })

  it("title-cases a lowercase category name", () => {
    expect(buildStageUpdateMessage({ ...base, categoryName: "installation" }))
      .toContain("Installation stage")
  })

  it("drops the category clause when there is no category", () => {
    const m = buildStageUpdateMessage({ ...base, categoryName: null })
    expect(m).not.toMatch(/in the .* stage/)
    expect(m).not.toContain("undefined")
    expect(m).not.toContain("null")
    expect(m).toContain("Graphene Coating service")
  })

  it("falls back gracefully when the vehicle unit is missing", () => {
    const m = buildStageUpdateMessage({ ...base, vehicleUnit: null })
    expect(m).toContain("for plate ABC-826")
    expect(m).not.toContain("your  (plate")
    expect(m).not.toContain("undefined")
  })

  it("uses a generic header when neither vehicle unit nor plate is known", () => {
    const m = buildStageUpdateMessage({ ...base, vehicleUnit: null, plate: null })
    expect(m).toContain("✅ Service update for your vehicle")
  })

  it("omits the progress line when counts are missing or total is zero", () => {
    expect(buildStageUpdateMessage({ ...base, completedCount: undefined, totalCount: undefined }))
      .not.toContain("Progress:")
    expect(buildStageUpdateMessage({ ...base, completedCount: 0, totalCount: 0 }))
      .not.toContain("Progress:")
  })

  it("treats an em-dash placeholder as missing", () => {
    const m = buildStageUpdateMessage({ ...base, vehicleUnit: "—", serviceName: "—" })
    expect(m).toContain("for plate ABC-826")
    expect(m).not.toContain("your — (plate")
    expect(m).not.toMatch(/of your .* service/)
  })
})
