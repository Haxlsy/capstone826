import { describe, it, expect } from "vitest"
import { jobStatusAfterStageDone } from "@/lib/operations/job-status-after-stage"

const done = (round = 0) => ({ status: "done", current_rework_round: round })

describe("jobStatusAfterStageDone", () => {
  it("returns to Ongoing when a head technician's mid-job rework is finished", () => {
    expect(jobStatusAfterStageDone({
      currentStatus: "For Rework",
      stages: [done(1), { status: "pending", current_rework_round: 0 }, { status: "pending", current_rework_round: 0 }],
    })).toBe("Ongoing")
  })

  it("goes to For Inspection when the last stage is done", () => {
    expect(jobStatusAfterStageDone({
      currentStatus: "For Rework",
      stages: [done(), done(1), done()],
    })).toBe("For Inspection")
  })

  it("stays For Rework while another stage is still being reworked", () => {
    expect(jobStatusAfterStageDone({
      currentStatus: "For Rework",
      stages: [done(1), { status: "for_rework", current_rework_round: 1 }],
    })).toBeNull()
    expect(jobStatusAfterStageDone({
      currentStatus: "For Rework",
      stages: [done(1), { status: "in_progress", current_rework_round: 2 }, { status: "pending" }],
    })).toBeNull()
  })

  it("leaves jobs that aren't in For Rework alone", () => {
    for (const currentStatus of ["Pending", "Ongoing", "Delayed", null]) {
      expect(jobStatusAfterStageDone({ currentStatus, stages: [done()] })).toBeNull()
    }
  })

  it("doesn't let a legacy in-progress stage (round 0) block the return to Ongoing", () => {
    expect(jobStatusAfterStageDone({
      currentStatus: "For Rework",
      stages: [done(1), { status: "in_progress", current_rework_round: 0 }],
    })).toBe("Ongoing")
  })
})
