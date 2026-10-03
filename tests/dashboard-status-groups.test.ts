import { describe, it, expect } from "vitest"
import { statusKeysForRow } from "@/lib/operations/dashboard-data"

const STATUS_LABEL_TO_KEY: Record<string, string> = {
  "Pending":        "pending",
  "Ongoing":        "ongoing",
  "For Rework":     "for_rework",
  "For Inspection": "for_inspection",
  "For Release":    "for_release",
  "Delayed":        "delayed",
  "Cancelled":      "cancelled",
}

describe("statusKeysForRow", () => {
  it("buckets a job literally marked Delayed under delayed only", () => {
    const keys = statusKeysForRow({ id: "a", status: "Delayed" }, new Set(), STATUS_LABEL_TO_KEY)
    expect(keys).toEqual(["delayed"])
  })

  it("buckets an active job under its own status when it isn't overdue", () => {
    const keys = statusKeysForRow({ id: "a", status: "Ongoing" }, new Set(), STATUS_LABEL_TO_KEY)
    expect(keys).toEqual(["ongoing"])
  })

  it("buckets an overdue active job under BOTH its own status and delayed", () => {
    const keys = statusKeysForRow({ id: "a", status: "Ongoing" }, new Set(["a"]), STATUS_LABEL_TO_KEY)
    expect(keys).toEqual(["ongoing", "delayed"])
  })

  it("never double-adds delayed for a job whose own status is already Delayed", () => {
    const keys = statusKeysForRow({ id: "a", status: "Delayed" }, new Set(["a"]), STATUS_LABEL_TO_KEY)
    expect(keys).toEqual(["delayed"])
  })

  it("returns no bucket for a status outside the map (e.g. Released)", () => {
    const keys = statusKeysForRow({ id: "a", status: "Released" }, new Set(), STATUS_LABEL_TO_KEY)
    expect(keys).toEqual([])
  })

  it("matches the exact count rule: total delayed bucket entries equal literal-Delayed rows plus overdue rows", () => {
    const rows = [
      { id: "1", status: "Delayed" },
      { id: "2", status: "Ongoing" },
      { id: "3", status: "Ongoing" },
      { id: "4", status: "Pending" },
      { id: "5", status: "Released" },
    ]
    const overdueJobIds = new Set(["2", "4"]) // "2" is Ongoing+overdue, "4" is Pending+overdue
    const delayedCount = rows.filter(
      (r) => statusKeysForRow(r, overdueJobIds, STATUS_LABEL_TO_KEY).includes("delayed"),
    ).length
    // 1 literal Delayed row + 2 overdue active rows = 3
    expect(delayedCount).toBe(3)
  })
})
