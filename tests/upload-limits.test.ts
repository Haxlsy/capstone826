import { describe, it, expect } from "vitest"
import { uploadSizeProblem, MAX_UPLOAD_REQUEST_BYTES } from "@/lib/media/limits"

const MB = 1024 * 1024

describe("uploadSizeProblem", () => {
  it("accepts files small enough to send", () => {
    expect(uploadSizeProblem({ size: 0.8 * MB, type: "image/jpeg" })).toBeNull()
    expect(uploadSizeProblem({ size: 2 * MB, type: "video/mp4" })).toBeNull()
    expect(uploadSizeProblem({ size: MAX_UPLOAD_REQUEST_BYTES, type: "video/webm" })).toBeNull()
  })

  it("stays under the host's 4.5 MB request limit", () => {
    expect(MAX_UPLOAD_REQUEST_BYTES).toBeLessThan(4.5 * MB)
  })

  it("refuses an oversize video and says how large it is", () => {
    const msg = uploadSizeProblem({ size: 38 * MB, type: "video/mp4" })
    expect(msg).toContain("38.0 MB")
    expect(msg).toContain("video")
    expect(msg).toContain("Video button")
  })

  it("refuses an oversize photo with a photo message", () => {
    const msg = uploadSizeProblem({ size: 6 * MB, type: "image/jpeg" })
    expect(msg).toContain("6.0 MB")
    expect(msg).toContain("photo")
  })
})
