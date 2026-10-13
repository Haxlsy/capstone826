import { describe, it, expect } from "vitest"
import {
  validateJobStages,
  STAGE_NAME_REQUIRED,
  STAGE_NAME_DUPLICATE,
  STAGE_DURATION_TOO_SHORT,
} from "@/lib/operations/job-stage-validation"

describe("validateJobStages", () => {
  it("accepts named stages of at least a minute", () => {
    expect(
      validateJobStages([
        { id: "a", name: "Car Wash", stage_duration_mins: 60 },
        { id: "b", name: "Car Dry", stage_duration_mins: 1 },
      ]),
    ).toEqual({})
    expect(validateJobStages([])).toEqual({})
  })

  it("rejects a stage left at 0 minutes, the default for a newly added stage", () => {
    expect(validateJobStages([{ id: "new", name: "Car Dry", stage_duration_mins: 0 }])).toEqual({
      new: STAGE_DURATION_TOO_SHORT,
    })
  })

  it("rejects a missing, negative or non-numeric duration", () => {
    const out = validateJobStages([
      { id: "a", name: "One", stage_duration_mins: null },
      { id: "b", name: "Two", stage_duration_mins: -5 },
      { id: "c", name: "Three", stage_duration_mins: Number.NaN },
    ])
    expect(out).toEqual({ a: STAGE_DURATION_TOO_SHORT, b: STAGE_DURATION_TOO_SHORT, c: STAGE_DURATION_TOO_SHORT })
  })

  it("rejects an empty or blank name", () => {
    const out = validateJobStages([
      { id: "a", name: "", stage_duration_mins: 30 },
      { id: "b", name: "   ", stage_duration_mins: 30 },
      { id: "c", name: null, stage_duration_mins: 30 },
    ])
    expect(out).toEqual({ a: STAGE_NAME_REQUIRED, b: STAGE_NAME_REQUIRED, c: STAGE_NAME_REQUIRED })
  })

  it("flags the later of two stages with the same name, ignoring case and spaces", () => {
    const out = validateJobStages([
      { id: "a", name: "Car Wash", stage_duration_mins: 30 },
      { id: "b", name: "  car wash ", stage_duration_mins: 30 },
    ])
    expect(out).toEqual({ b: STAGE_NAME_DUPLICATE })
  })

  it("reports the name problem first when a stage has two problems", () => {
    expect(validateJobStages([{ id: "a", name: "", stage_duration_mins: 0 }])).toEqual({ a: STAGE_NAME_REQUIRED })
  })
})
