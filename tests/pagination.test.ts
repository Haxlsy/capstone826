import { describe, it, expect } from "vitest"
import { pageSlice } from "@/lib/ui/pagination"

const items = Array.from({ length: 24 }, (_, i) => i + 1)

describe("pageSlice", () => {
  it("returns the first page", () => {
    expect(pageSlice(items, 1, 8)).toEqual({ rows: [1, 2, 3, 4, 5, 6, 7, 8], page: 1, totalPages: 3, from: 1, to: 8 })
  })

  it("returns a middle and the last page", () => {
    expect(pageSlice(items, 2, 8)).toMatchObject({ page: 2, from: 9, to: 16 })
    expect(pageSlice(items, 3, 8)).toMatchObject({ page: 3, from: 17, to: 24 })
  })

  it("handles a short last page", () => {
    expect(pageSlice(items.slice(0, 19), 3, 8)).toMatchObject({ rows: [17, 18, 19], from: 17, to: 19 })
  })

  it("clamps a page past the end (the list shrank) and below 1", () => {
    expect(pageSlice(items.slice(0, 10), 3, 8)).toMatchObject({ page: 2, from: 9, to: 10 })
    expect(pageSlice(items, 0, 8)).toMatchObject({ page: 1, from: 1 })
  })

  it("handles an empty list", () => {
    expect(pageSlice([], 4, 8)).toEqual({ rows: [], page: 1, totalPages: 1, from: 0, to: 0 })
  })
})
