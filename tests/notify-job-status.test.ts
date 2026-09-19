import { describe, it, expect } from "vitest"
import { jobStatusMessage, notifyJobStatusChange, stageDoneMessage, notifyStageDone } from "@/lib/notify-job-status"

function fakeAdmin(userIds: string[]) {
  const inserted: Record<string, unknown>[][] = []
  const admin = {
    from(table: string) {
      if (table === "user_account") {
        const chain: any = { select: () => chain, eq: () => chain, then: (r: any) => r({ data: userIds.map((id) => ({ id })) }) }
        return chain
      }
      return { insert: async (rows: Record<string, unknown>[]) => { inserted.push(rows); return {} } }
    },
  }
  return { admin: admin as never, inserted }
}

describe("jobStatusMessage", () => {
  it.each([
    ["Ongoing", "started"],
    ["For Inspection", "ready for inspection"],
    ["For Rework", "rework"],
    ["For Release", "ready for release"],
    ["Released", "released"],
    ["Completed", "completed"],
    ["Cancelled", "cancelled"],
  ])("%s wording", (to, needle) => {
    expect(jobStatusMessage("JO-1", "Pending", to)).toContain(needle)
    expect(jobStatusMessage("JO-1", "Pending", to)).toContain("JO-1")
  })
  it("falls back to a generic from → to line", () => {
    expect(jobStatusMessage("JO-1", "A", "Weird")).toBe("Job JO-1 status changed from A to Weird.")
    expect(jobStatusMessage("JO-1", null, "Weird")).toBe("Job JO-1 status changed to Weird.")
  })
})

describe("notifyJobStatusChange", () => {
  it("notifies every Operations user except the actor", async () => {
    const { admin, inserted } = fakeAdmin(["a", "b", "c"])
    await notifyJobStatusChange(admin, { jobId: "j1", jobLabel: "JO-1", from: "Ongoing", to: "For Release", actorId: "b" })
    expect(inserted).toHaveLength(1)
    expect(inserted[0].map((r) => r.user_id)).toEqual(["a", "c"])
    expect(inserted[0][0]).toMatchObject({ type: "job_status", job_order_id: "j1", message: "Job JO-1 is ready for release." })
  })
  it("uses type rework and a custom message when given", async () => {
    const { admin, inserted } = fakeAdmin(["a"])
    await notifyJobStatusChange(admin, { jobId: "j1", jobLabel: "JO-1", to: "For Rework", message: "custom" })
    expect(inserted[0][0]).toMatchObject({ type: "rework", message: "custom" })
  })
  it("does nothing when the status did not change, or the actor is the only user", async () => {
    const a = fakeAdmin(["a"])
    await notifyJobStatusChange(a.admin, { jobId: "j", jobLabel: "x", from: "Ongoing", to: "Ongoing" })
    await notifyJobStatusChange(a.admin, { jobId: "j", jobLabel: "x", to: "Released", actorId: "a" })
    expect(a.inserted).toHaveLength(0)
  })
})

describe("stage done", () => {
  it("message with and without progress / rework round", () => {
    expect(stageDoneMessage("JO-1", "Polishing", { done: 3, total: 5 })).toBe('Stage "Polishing" is done on job JO-1 (3/5 stages).')
    expect(stageDoneMessage("JO-1", "Polishing")).toBe('Stage "Polishing" is done on job JO-1.')
    expect(stageDoneMessage("JO-1", "Polishing", { done: 3, total: 5, reworkRound: 2 })).toContain('Rework 2 of stage "Polishing"')
  })
  it("notifies Operations except the actor, linked to the job and stage", async () => {
    const { admin, inserted } = fakeAdmin(["a", "b"])
    await notifyStageDone(admin, { jobId: "j1", jobLabel: "JO-1", stageId: "s1", stageName: "Wash", actorId: "a" })
    expect(inserted[0]).toHaveLength(1)
    expect(inserted[0][0]).toMatchObject({ user_id: "b", type: "job_status", job_order_id: "j1", stage_id: "s1" })
  })
})
