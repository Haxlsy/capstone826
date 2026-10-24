import { describe, it, expect } from "vitest"
import { startReworkRound } from "@/lib/operations/rework-round"

type Row = { id: string; current_rework_round: number | null }

/** Records every update call; `select` returns the given rows. */
function fakeAdmin(rows: Row[], updateError: { message: string } | null = null) {
  const updates: { values: Record<string, unknown>; id?: string }[] = []
  const admin = {
    from: () => ({
      select: () => ({
        in: () => ({ eq: async () => ({ data: rows, error: null }) }),
      }),
      update: (values: Record<string, unknown>) => {
        const entry: { values: Record<string, unknown>; id?: string } = { values }
        updates.push(entry)
        const chain = {
          eq: (col: string, val: string) => {
            if (col === "id") entry.id = val
            return chain
          },
          then: (resolve: (v: { error: { message: string } | null }) => void) => resolve({ error: updateError }),
        }
        return chain
      },
    }),
  }
  return { admin: admin as never, updates }
}

describe("startReworkRound", () => {
  it("bumps the stage to the next round and applies the fields", async () => {
    const { admin, updates } = fakeAdmin([{ id: "s1", current_rework_round: 0 }])
    const result = await startReworkRound(admin, "job1", ["s1"], { status: "in_progress", rework_instructions: "Redo" })
    expect(result.error).toBeNull()
    expect(updates).toEqual([
      { id: "s1", values: { status: "in_progress", rework_instructions: "Redo", current_rework_round: 1 } },
    ])
  })

  it("bumps each stage from its own current round", async () => {
    const { admin, updates } = fakeAdmin([
      { id: "s1", current_rework_round: 2 },
      { id: "s2", current_rework_round: null },
    ])
    await startReworkRound(admin, "job1", ["s1", "s2"], { status: "for_rework" })
    expect(updates.map((u) => [u.id, u.values.current_rework_round])).toEqual([["s1", 3], ["s2", 1]])
  })

  it("returns the update error", async () => {
    const { admin } = fakeAdmin([{ id: "s1", current_rework_round: 0 }], { message: "boom" })
    expect((await startReworkRound(admin, "job1", ["s1"], {})).error).toEqual({ message: "boom" })
  })

  it("does nothing for an empty list", async () => {
    const { admin, updates } = fakeAdmin([])
    expect((await startReworkRound(admin, "job1", [], {})).error).toBeNull()
    expect(updates).toHaveLength(0)
  })
})
