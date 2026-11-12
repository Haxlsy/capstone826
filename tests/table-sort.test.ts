import { describe, it, expect } from "vitest"
import { compareValues, toggleSort } from "@/lib/table-sort"

const sortText = (values: (string | null)[], dir: "asc" | "desc") =>
  [...values].sort((a, b) => compareValues(a, b, "text", dir))

describe("toggleSort", () => {
  it("starts a new column ascending and flips the same column", () => {
    expect(toggleSort({ sortBy: "a", sortDir: "desc" }, "b")).toEqual({ sortBy: "b", sortDir: "asc" })
    expect(toggleSort({ sortBy: "b", sortDir: "asc" }, "b")).toEqual({ sortBy: "b", sortDir: "desc" })
    expect(toggleSort({ sortBy: "b", sortDir: "desc" }, "b")).toEqual({ sortBy: "b", sortDir: "asc" })
  })
})

describe("compareValues", () => {
  it("sorts job codes by number, not by character", () => {
    expect(sortText(["JO-0010", "JO-0009", "JO-0100"], "asc")).toEqual(["JO-0009", "JO-0010", "JO-0100"])
  })

  it("ignores letter case", () => {
    expect(sortText(["bravo", "Alpha", "charlie"], "asc")).toEqual(["Alpha", "bravo", "charlie"])
    expect(sortText(["bravo", "Alpha", "charlie"], "desc")).toEqual(["charlie", "bravo", "Alpha"])
  })

  it("keeps empty values and Unassigned last in both directions", () => {
    const values = ["Unassigned", "Ben", "—", "Ana", null]
    expect(sortText(values, "asc").slice(0, 2)).toEqual(["Ana", "Ben"])
    expect(sortText(values, "desc").slice(0, 2)).toEqual(["Ben", "Ana"])
  })

  it("orders dates chronologically", () => {
    const dates = ["2026-11-12T08:00:00Z", "2026-01-05T08:00:00Z", null, "2026-06-01T08:00:00Z"]
    const asc = [...dates].sort((a, b) => compareValues(a, b, "time", "asc"))
    expect(asc).toEqual(["2026-01-05T08:00:00Z", "2026-06-01T08:00:00Z", "2026-11-12T08:00:00Z", null])
    const desc = [...dates].sort((a, b) => compareValues(a, b, "time", "desc"))
    expect(desc).toEqual(["2026-11-12T08:00:00Z", "2026-06-01T08:00:00Z", "2026-01-05T08:00:00Z", null])
  })
})

describe("table-sort: number kind and default order", () => {
  it("starts the clicked column ascending when nothing is sorted yet", () => {
    expect(toggleSort<"a">({ sortBy: null, sortDir: "desc" }, "a")).toEqual({ sortBy: "a", sortDir: "asc" })
  })

  it("compares numbers numerically and keeps null last", () => {
    const ranks = [3, null, 0, 10, 1]
    expect([...ranks].sort((a, b) => compareValues(a, b, "number", "asc"))).toEqual([0, 1, 3, 10, null])
    expect([...ranks].sort((a, b) => compareValues(a, b, "number", "desc"))).toEqual([10, 3, 1, 0, null])
  })
})
