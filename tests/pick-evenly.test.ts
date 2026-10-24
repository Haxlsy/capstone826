import { describe, it, expect, vi } from "vitest"

// lib/media/video.ts points fluent-ffmpeg at the ffmpeg-static binary on load;
// neither is needed to test the pure frame picker.
vi.mock("fluent-ffmpeg", () => ({ default: Object.assign(vi.fn(), { setFfmpegPath: vi.fn() }) }))
vi.mock("ffmpeg-static", () => ({ default: null }))

const { pickEvenly } = await import("@/lib/media/video")

describe("pickEvenly", () => {
  it("returns everything when there are n or fewer items", () => {
    expect(pickEvenly(["a"], 4)).toEqual(["a"])
    expect(pickEvenly(["a", "b", "c", "d"], 4)).toEqual(["a", "b", "c", "d"])
  })

  it("spreads picks from the first to the last item", () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    expect(pickEvenly(items, 4)).toEqual([0, 3, 6, 9])
  })

  it("covers a long video end to end", () => {
    const items = Array.from({ length: 60 }, (_, i) => i)
    const picked = pickEvenly(items, 4)
    expect(picked[0]).toBe(0)
    expect(picked[3]).toBe(59)
    expect(picked).toHaveLength(4)
  })

  it("handles n of 1 and 0", () => {
    expect(pickEvenly([1, 2, 3], 1)).toEqual([2])
    expect(pickEvenly([1, 2, 3], 0)).toEqual([])
  })
})
