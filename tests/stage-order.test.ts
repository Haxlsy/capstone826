import { describe, it, expect } from "vitest"
import { orderStagesByCategory } from "@/lib/operations/stage-order"

type S = { name: string; cat: string | null }
const names = (stages: S[]) => stages.map((s) => s.name)
const order = (stages: S[]) => orderStagesByCategory(stages, (s) => s.cat)

describe("orderStagesByCategory", () => {
  it("moves a stage added at the end back into its category", () => {
    // Beta bug 1: "Stage 3" was added under Preparation but saved as #7.
    const stages: S[] = [
      { name: "Stage 1", cat: "prep" },
      { name: "Stage 2", cat: "prep" },
      { name: "Stage 4", cat: "install" },
      { name: "Stage 5", cat: "install" },
      { name: "Stage 6", cat: "qc" },
      { name: "Stage 7", cat: "qc" },
      { name: "Stage 3", cat: "prep" },
    ]
    expect(names(order(stages))).toEqual([
      "Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6", "Stage 7",
    ])
  })

  it("keeps a category's stages together when another category was inserted in the middle", () => {
    // Beta bug 2: Installation stages landed between two halves of Preparation.
    const stages: S[] = [
      { name: "Premium Wash", cat: "prep" },
      { name: "Decontamination", cat: "prep" },
      { name: "None", cat: "install" },
      { name: "None1", cat: "install" },
      { name: "Clay Mitt", cat: "prep" },
      { name: "Acid Removal", cat: "prep" },
    ]
    expect(names(order(stages))).toEqual([
      "Premium Wash", "Decontamination", "Clay Mitt", "Acid Removal", "None", "None1",
    ])
  })

  it("leaves an already-grouped list unchanged", () => {
    const stages: S[] = [
      { name: "a", cat: "prep" },
      { name: "b", cat: "install" },
      { name: "c", cat: "qc" },
    ]
    expect(order(stages)).toEqual(stages)
  })

  it("groups stages without a category together", () => {
    const stages: S[] = [
      { name: "a", cat: null },
      { name: "b", cat: "prep" },
      { name: "c", cat: null },
    ]
    expect(names(order(stages))).toEqual(["a", "c", "b"])
  })
})
