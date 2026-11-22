import { describe, it, expect, vi } from "vitest"
import { videoDurationProblem, MIN_VIDEO_SECONDS } from "@/lib/media/limits"
import { PHOTO_TIP, VIDEO_TIP, ATTACH_TIP, STAGE_GUIDE_STEPS } from "@/lib/head-technician/upload-help"

// Only the pure parser is tested here; ffmpeg itself isn't needed.
vi.mock("fluent-ffmpeg", () => ({ default: Object.assign(vi.fn(), { setFfmpegPath: vi.fn() }) }))
vi.mock("ffmpeg-static", () => ({ default: null }))
const { parseFfmpegSeconds } = await import("@/lib/media/video")

describe("videoDurationProblem", () => {
  it("refuses clips under the minimum", () => {
    expect(videoDurationProblem(1)).toMatch(/only 1 second long/)
    expect(videoDurationProblem(3.2)).toMatch(/at least 5 seconds/)
    expect(videoDurationProblem(0)).toMatch(/only 0 seconds/)
  })

  it("accepts the minimum, allowing for the recorder's start-up moment", () => {
    expect(videoDurationProblem(MIN_VIDEO_SECONDS)).toBeNull()
    expect(videoDurationProblem(4.6)).toBeNull()
    expect(videoDurationProblem(42)).toBeNull()
  })

  it("lets an unknown length through for the server to measure", () => {
    expect(videoDurationProblem(null)).toBeNull()
    expect(videoDurationProblem(undefined)).toBeNull()
    expect(videoDurationProblem(Number.POSITIVE_INFINITY)).toBeNull()
    expect(videoDurationProblem(Number.NaN)).toBeNull()
  })
})

describe("parseFfmpegSeconds", () => {
  it("reads the furthest progress time", () => {
    const out = [
      "  Duration: N/A, start: 0.000000, bitrate: N/A",
      "frame=  60 fps=0.0 q=-1.0 size=N/A time=00:00:02.00 bitrate=N/A",
      "frame= 210 fps=0.0 q=-1.0 Lsize=N/A time=00:00:07.04 bitrate=N/A",
    ].join("\n")
    expect(parseFfmpegSeconds(out)).toBeCloseTo(7.04)
  })

  it("falls back to the header duration", () => {
    expect(parseFfmpegSeconds("  Duration: 00:01:03.50, start: 0.000000")).toBeCloseTo(63.5)
  })

  it("is null when nothing is readable", () => {
    expect(parseFfmpegSeconds("Duration: N/A\nInvalid data found when processing input")).toBeNull()
    expect(parseFfmpegSeconds("")).toBeNull()
  })
})

describe("upload help text", () => {
  it("states the minimum video length wherever videos are mentioned", () => {
    expect(VIDEO_TIP.points.join(" ")).toContain(`${MIN_VIDEO_SECONDS}`)
    expect(ATTACH_TIP.points.join(" ")).toContain(`${MIN_VIDEO_SECONDS} seconds`)
    expect(STAGE_GUIDE_STEPS.some((s) => s.includes(`${MIN_VIDEO_SECONDS} to`))).toBe(true)
    expect(PHOTO_TIP.points.length).toBeGreaterThan(0)
  })
})
